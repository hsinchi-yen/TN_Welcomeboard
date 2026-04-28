# Plan: Multi-Screen Multi-Port Display Management

## Context

目前系統固定一台 Preview Device（UUID: `00000000-0000-0000-0000-000000000001`）、單一 port 8080。使用者需要從一台管理伺服器同時投放不同 Playlist 到最多 10 個獨立畫面（localhost:8080 ~ localhost:8089）。

每個 port 代表一個獨立的顯示畫面，可各自接收不同 Playlist，並可彈性新增/移除。Electron converter 不在本次範圍。

---

## Architecture Decision

**選擇：Go 多 HTTP Listener（每個 port 一個獨立 `http.Server` goroutine）**

- Single Go process，shared Hub + DB pool
- Port 8080 = 既有 Gin engine（不變）
- Port 8081-8089 = 各自獨立的輕量 Gin engine（只服務 `/`、`/ws`、`/media/*`）
- 每個 sub-listener 的 display HTML 嵌入對應的 `device_id`，WebSocket 透過 `location.host` 自動連到正確 port
- 所有 port 共享同一個 WebSocket Hub → 廣播仍走 `hub.BroadcastToDevice(deviceID, msg)`

不選多 Docker container：資源浪費，且 Hub/DB 需要額外同步機制。
不選 nginx port routing：每次新增 port 要 reload config，不夠動態。

---

## Dependency Graph

```
Task 1: DB migration + Model + Repo  ← 所有其他 Task 的基礎
    ↓
Task 2: Backend API (port CRUD)      ← Task 3、4 的前提
    ↓
Task 3: Port Listener Lifecycle      ← 可在 Task 4 之前獨立驗證
    ↓
[Checkpoint A: curl 驗證]
    ↓
Task 4: Frontend Displays 頁         ← 需要 Task 2 的 API
    ↓
Task 5: Dashboard 多裝置更新          ← 需要 Task 2 的 devices API
    ↓
[Checkpoint B: 瀏覽器 end-to-end 驗證]
    ↓
Task 6: Infrastructure (docker-compose)
    ↓
[Checkpoint C: Docker 部署驗證]
```

---

## Task 1 — DB Migration + Model + Repository CRUD

### Files to create/modify
- `backend/migrations/002_add_display_ports.up.sql` ← 新建
- `backend/migrations/002_add_display_ports.down.sql` ← 新建
- `backend/internal/model/model.go` ← 新增 `DisplayPort` struct
- `backend/internal/repository/crud.go` ← 新增 4 個 CRUD methods

### Schema

```sql
-- 002_add_display_ports.up.sql
CREATE TABLE display_ports (
    port_number INTEGER PRIMARY KEY
        CHECK (port_number BETWEEN 8080 AND 8089),
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    label       VARCHAR(100) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

port_number 為 PK（天然唯一）；不用 UUID，因為 port 本身就是識別子。

```sql
-- 002_add_display_ports.down.sql
DROP TABLE IF EXISTS display_ports;
```

### Model struct (model.go)

```go
type DisplayPort struct {
    PortNumber int       `json:"port_number" db:"port_number"`
    DeviceID   string    `json:"device_id"   db:"device_id"`
    Label      string    `json:"label"       db:"label"`
    CreatedAt  time.Time `json:"created_at"  db:"created_at"`
    // computed, not in DB:
    DeviceName string    `json:"device_name,omitempty"`
    IsOnline   bool      `json:"is_online"`
}
```

### Repository methods (crud.go)

遵循現有模式：positional params，`SelectContext` / `QueryRowContext` / `ExecContext`。

```go
GetDisplayPorts(ctx) ([]DisplayPort, error)     // SELECT + JOIN devices.name
GetDisplayPort(ctx, portNumber int) (DisplayPort, error)
CreateDisplayPort(ctx, dp *DisplayPort) error    // INSERT
DeleteDisplayPort(ctx, portNumber int) error     // DELETE WHERE port_number=$1
EnsureDefaultPort(ctx) error                     // UPSERT port 8080 → PreviewDeviceID
```

### Acceptance Criteria
- `docker compose up --build` 成功執行 migration
- `SELECT * FROM display_ports;` 顯示 port 8080 的預設記錄
- repository unit test（可選）：GetDisplayPorts 回傳 []

---

## Task 2 — Backend API: Port Management + Remove Device Limit

### Files to modify
- `backend/internal/handler/handler.go`
- `backend/cmd/server/main.go`
- `backend/internal/service/service.go`

### 1. Remove device limit (handler.go line 69)

刪除：
```go
if len(devices) >= 1 {
    c.JSON(http.StatusConflict, gin.H{"error": "only one device is allowed in MVP mode"})
    return
}
```

裝置數量上限由 `display_ports` 的 CHECK constraint（最多 10 個 port）隱性限制。

### 2. New API handlers (handler.go)

```
GET    /api/v1/ports          → GetDisplayPorts   (list with device_name + is_online)
POST   /api/v1/ports          → CreateDisplayPort  (validate port 8081-8089, device exists)
DELETE /api/v1/ports/:port    → DeleteDisplayPort  (拒絕刪除 port 8080)
```

POST body:
```json
{ "port_number": 8081, "device_id": "<uuid>", "label": "Reception" }
```

Response includes `is_online` (from hub.IsDeviceConnected).

### 3. Register routes (main.go)

```go
v1.GET("/ports", hand.GetDisplayPorts)
v1.POST("/ports", hand.CreateDisplayPort)
v1.DELETE("/ports/:port", hand.DeleteDisplayPort)
```

### 4. EnsureDefaultPort (service.go)

在 `EnsurePreviewDevice` 之後呼叫 `repo.EnsureDefaultPort(ctx)`，確保 port 8080 記錄存在。

### Acceptance Criteria
- `GET /api/v1/ports` 回傳含 port 8080 的陣列
- `POST /api/v1/ports` 成功新增 8081，`GET` 可看到
- `DELETE /api/v1/ports/8080` 回傳 400 "default port cannot be removed"
- `DELETE /api/v1/ports/8081` 成功，GET 確認已移除
- 可建立超過 1 台 device（原限制已移除）

---

## Task 3 — Port Listener Lifecycle

### Files to modify / create
- `backend/internal/service/service.go` ← 新增 PortManager
- `backend/internal/handler/handler.go` ← export `BuildDisplayHTML`
- `backend/cmd/server/main.go` ← 啟動時載入 ports

### PortManager design (service.go)

```go
type PortManager struct {
    mu         sync.Mutex
    servers    map[int]*http.Server  // port → running server
    hub        *hub.Hub
    mediaDir   string
    htmlGen    func(deviceID string) string
}

func (pm *PortManager) Start(portNumber int, deviceID string) error
func (pm *PortManager) Stop(portNumber int) error
func (pm *PortManager) StopAll()
```

每個 sub-listener 是一個輕量 http.ServeMux：
- `GET /`       → `htmlGen(deviceID)` 的 HTML
- `GET /ws`     → 包裝 WebSocket upgrader，連接到共享 Hub（device_id 從 query param 取）
- `GET /media/` → `http.FileServer(http.Dir(mediaDir))`

Port 8080 由主 Gin engine 提供，PortManager 不管它（Start/Stop 會拒絕 port 8080）。

### Export BuildDisplayHTML (handler.go)

```go
// 將現有的 buildDisplayHTML 改名為 BuildDisplayHTML（exported）
func BuildDisplayHTML(deviceID string, logoURI string) string { ... }
```

Handler 自用時傳入 `logoWhiteDataURI`；PortManager 也傳入同一個 constant。

### Startup sequence (main.go)

```go
// After EnsureDefaultPort:
ports, _ := repo.GetDisplayPorts(ctx)
pm := service.NewPortManager(h, mediaDir, func(id string) string {
    return handler.BuildDisplayHTML(id, logoWhiteDataURI)
})
for _, p := range ports {
    if p.PortNumber == 8080 { continue }
    pm.Start(p.PortNumber, p.DeviceID)
}
defer pm.StopAll()
```

### API handlers integrate with PortManager

- `CreateDisplayPort` handler：DB insert 成功後呼叫 `pm.Start(port, deviceID)`
- `DeleteDisplayPort` handler：DB delete 成功後呼叫 `pm.Stop(port)`

Pass `pm` into handler via `Handler` struct 的新欄位。

### Graceful Shutdown

`pm.StopAll()` 在 main.go 的 defer chain 中呼叫（在 `svc.Shutdown()` 之前），等待每個 sub-server 的 in-flight request 完成（5s timeout）。

### Stability Design
- Sub-listener goroutine 有 `recover()` panic handler
- Port 衝突（bind error）在 `pm.Start` 時立即回傳錯誤，不插入 DB
- Sub-listener 崩潰不影響其他 port 和主 8080

### Acceptance Criteria
- `docker compose up` 後，`curl localhost:8080` 和 `curl localhost:8081`（若已設定）都能拿到 display HTML
- sub-listener 的 WebSocket 連上 Hub（`hub.IsDeviceConnected` 回 true）
- 刪除 port 8081 後，listener 停止，`curl localhost:8081` 連線拒絕
- 重啟後 DB 裡的 ports 自動重建 listeners

---

## Checkpoint A — Backend End-to-End Verification

手動驗證步驟：
1. `docker compose up --build`
2. `curl localhost:8080/api/v1/ports` → 含 port 8080
3. 建一台新 device：`POST /api/v1/devices`
4. 新增 port 8081：`POST /api/v1/ports {"port_number":8081,"device_id":"<uuid>","label":"Test"}`
5. `curl localhost:8081` → 看到 display HTML，DEVICE_ID 是步驟 3 的 uuid
6. 開啟 `localhost:8081` → SMPTE 色條（沒有 Playlist 投放時的預設畫面）
7. `POST /api/v1/devices/<uuid>/push {"playlist_id":"<any>"}` → 8081 畫面切換
8. `DELETE /api/v1/ports/8081` → 8081 連線拒絕，8080 不受影響

---

## Task 4 — Frontend: Displays Management Page

### Files to create/modify
- `frontend/src/store/useStore.ts` ← 新增 DisplayPort state + actions
- `frontend/src/pages/Displays.tsx` ← 新建
- `frontend/src/App.tsx` ← 新增 route + nav item

### Store additions (useStore.ts)

仿照現有 Schedule 的模式：

```typescript
interface DisplayPort {
  port_number: number;
  device_id: string;
  label: string;
  created_at: string;
  device_name?: string;
  is_online: boolean;
}

// State
displayPorts: DisplayPort[];

// Actions
fetchDisplayPorts: () => Promise<void>;
createDisplayPort: (data: { port_number: number; device_id: string; label: string }) => Promise<DisplayPort>;
deleteDisplayPort: (portNumber: number) => Promise<void>;
```

### Displays.tsx page layout

仿照 Schedules.tsx 的左面板（建立表單）+ 右面板（清單）模式：

**左面板 — 新增 Port**
- Port 號碼 select（8081-8089，排除已使用）
- 裝置 select（dropdown from `devices`）
- Label 文字輸入（可選）
- 新增按鈕

**右面板 — 現有 Ports 清單**
每列顯示：
- Port 號碼（`localhost:XXXX`，可點擊開啟新分頁）
- 裝置名稱
- Label
- Online 狀態指示（綠點/灰點）
- 刪除按鈕（port 8080 的刪除按鈕 disabled）

每列的「開啟」連結：`http://localhost:{port_number}`（target _blank）

### App.tsx changes

```typescript
import Displays from './pages/Displays';

// navItems:
{ name: 'Displays', path: '/displays' }

// Route:
<Route path="/displays" element={<Displays />} />
```

### Acceptance Criteria
- 進入 Displays 頁看到 port 8080 列，Online 狀態正確
- 新增 port 8081（選 device），清單更新，點 localhost:8081 連結開啟 display
- 刪除 8081，清單移除，8081 瀏覽器 tab 顯示斷線重連
- port 8080 刪除按鈕為 disabled

---

## Task 5 — Frontend: Dashboard Multi-Device Update

### Files to modify
- `frontend/src/pages/Dashboard.tsx`

### Changes

**移除 hardcoded constant：**
```typescript
// 刪除這行:
const PREVIEW_DEVICE_ID = '00000000-0000-0000-0000-000000000001';
```

**更新裝置列表邏輯：**
- `fetchDevices()` 已回傳所有 devices
- 每台 device 各自顯示一列（仿照目前的單裝置卡片，改為列表）
- 每列：device 名稱、online 狀態、Playlist selector、Push 按鈕、Preview iframe toggle
- `localStorage` key 改為 `wb:dashboard:selected:${device.id}`

**Preview iframe：**
- 目前 iframe src 固定為 `localhost:8080`
- 改為讀取該 device 對應的 port（需呼叫 `GET /api/v1/ports`，找到 `device_id === device.id` 的 port_number）
- 若找不到對應 port，Preview 按鈕 disabled

### Acceptance Criteria
- Dashboard 顯示所有 devices
- 每台各自可選 Playlist 並 Push，互不干擾
- Preview iframe 指向正確 port
- 移除 hardcoded UUID 後功能正常

---

## Checkpoint B — Frontend End-to-End Verification

1. `localhost:3000/displays` — 看到 port 8080，新增 8081
2. `localhost:3000` (Dashboard) — 看到兩台 devices，各自 Push 不同 Playlist
3. `localhost:8080` 和 `localhost:8081` 分別顯示各自 Playlist
4. 刪除 8081 → Displays 頁更新，Dashboard 的 Preview 對應按鈕 disabled

---

## Task 6 — Infrastructure Update

### Files to modify
- `docker-compose.yml`

### Changes

**後端 port range：**
```yaml
backend:
  ports:
    - "8080-8089:8080-8089"
```

注意：Docker 必須在 container 啟動時就 expose 這些 port。由於 Go 的 sub-listener 是動態啟動的，port 必須在 compose 層就已 expose（否則從 host 訪問會被 Docker 攔截）。

**CLAUDE.md 更新：**
- 新增 `display_ports` 到 DB Schema section
- 更新 Key System Behaviors（移除 Single Preview Device 限制說明）
- 更新 API Reference（新增 ports endpoints）

### Acceptance Criteria
- `docker compose up --build` 成功
- Host 可訪問 `localhost:8080` ~ `localhost:8089`（根據已設定的 ports）
- `docker compose down && docker compose up` 後，DB 中的 ports 自動重建 listeners

---

## Checkpoint C — Docker Deployment Verification

1. `docker compose down -v` 清空
2. `docker compose up --build -d`
3. Migration 自動執行，port 8080 記錄存在
4. 從 Admin 新增 port 8081，重啟 Docker，8081 listener 自動恢復

---

## Files Touch Summary

| File | Task | Change Type |
|---|---|---|
| `backend/migrations/002_add_display_ports.up.sql` | T1 | New |
| `backend/migrations/002_add_display_ports.down.sql` | T1 | New |
| `backend/internal/model/model.go` | T1 | Add struct |
| `backend/internal/repository/crud.go` | T1 | Add 5 methods |
| `backend/internal/handler/handler.go` | T2, T3 | Remove limit, add 3 handlers, export BuildDisplayHTML |
| `backend/internal/service/service.go` | T2, T3 | Add EnsureDefaultPort call, add PortManager |
| `backend/cmd/server/main.go` | T2, T3 | Register routes, init PortManager, load ports |
| `frontend/src/store/useStore.ts` | T4 | Add DisplayPort type + 3 actions |
| `frontend/src/pages/Displays.tsx` | T4 | New page |
| `frontend/src/App.tsx` | T4 | Route + nav |
| `frontend/src/pages/Dashboard.tsx` | T5 | Multi-device, remove hardcoded UUID |
| `docker-compose.yml` | T6 | Port range |
| `.claude/CLAUDE.md` | T6 | Update docs |

**Total: 13 files (2 new migrations, 1 new frontend page, rest are modifications)**

---

## Reusable Existing Code

- `hub.BroadcastToDevice(deviceID, msg)` — 不需改，直接用
- `hub.IsDeviceConnected(deviceID)` — 用於 is_online 欄位
- `buildDisplayHTML(deviceID)` — export 後供 PortManager 用
- `hand.ServeWs` — sub-listener 的 WebSocket handler（或提取為 http.HandlerFunc 共用）
- Schedules.tsx 的左右面板佈局 — Displays.tsx 的 UI 模板
- useStore 的 fetch/create/delete action 模式 — DisplayPort actions 的模板

---

## Stability Guarantees

- 每個 port 的 listener 在獨立 goroutine，crash 有 recover()，不影響其他 port
- 主 8080 Gin engine 完全不變，既有功能無風險
- PortManager.StopAll() 在 main() defer chain 確保優雅關閉
- DB unique constraint 防止 port 重複，比 application-level check 更可靠
- WebSocket reconnect（exponential backoff）已在 display HTML 實作，listener restart 後自動恢復
