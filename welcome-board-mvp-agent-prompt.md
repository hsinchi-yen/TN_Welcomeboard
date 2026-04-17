# Agent Prompt — Welcome Board Digital Signage MVP

## 角色設定

你是一位資深全端工程師，負責獨立完成一套自用數位看板（Digital Signage）系統的 MVP 開發。請嚴格按照下方規格實作，遇到技術選擇時優先選擇穩定、文件完整的方案，並在每個 Phase 完成後輸出驗證清單。

---

## 系統概述

打造一套個人自用的 Welcome Board 數位看板投放系統，包含：

1. **Windows 桌面轉換工具**（Electron + TypeScript）：將 PPTX 轉換為 HTML5 投影片
2. **後端服務**（Go + PostgreSQL + Docker）：管理內容、排程、投放
3. **管理後台**（React + TypeScript）：上傳內容、設定排程、預覽
4. **投放端**（Web Browser）：Phase 3 前以瀏覽器模擬 Kiosk 顯示

---

## 技術棧規格

### Windows 轉換工具
- Runtime: Electron 28+ with TypeScript
- PPTX 解析: `pptx2html` 或呼叫本機 LibreOffice headless CLI
- 輸出格式: 自包含 HTML5（含內嵌 CSS、base64 圖片）
- 打包: electron-builder，目標 Windows x64 installer

### 後端
- 語言: Go 1.22+
- Web Framework: `github.com/gin-gonic/gin`
- WebSocket: `github.com/gorilla/websocket`
- 排程: `github.com/go-co-op/gocron/v2`
- 資料庫 ORM: `github.com/jmoiron/sqlx` + 原生 SQL（不用 GORM）
- 資料庫: PostgreSQL 15（Docker）
- 遷移工具: `github.com/golang-migrate/migrate/v4`
- 靜態檔服務: Gin 內建 `Static()` 提供 media 目錄

### 前端管理後台
- Framework: React 18 + TypeScript + Vite
- UI: shadcn/ui + Tailwind CSS
- 狀態管理: Zustand
- HTTP Client: axios
- WebSocket: 原生 browser WebSocket API

### 容器化
- docker-compose.yml 一鍵啟動所有後端服務
- Services: `postgres`, `backend`, `frontend`（生產模式用 nginx serve build）
- Volume 掛載: `./media:/app/media`（持久化媒體檔）

---

## 資料庫 Schema

請使用 golang-migrate 建立以下 migration 檔案：

```sql
-- 001_init.up.sql

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE content_type AS ENUM ('html5', 'image', 'video');
CREATE TYPE playback_mode AS ENUM ('html5_slides', 'image_loop', 'video_loop');

CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    mode playback_mode NOT NULL,
    transition_seconds INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE playlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    content_type content_type NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    display_name VARCHAR(200),
    sort_order INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    playlist_id UUID NOT NULL REFERENCES playlists(id),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_device ON schedules(device_id);
CREATE INDEX idx_playlist_items_playlist ON playlist_items(playlist_id, sort_order);
```

---

## Phase 1 — Docker 環境與後端基礎

### 任務清單

**1.1 建立 docker-compose.yml**

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: signage
      POSTGRES_USER: signage
      POSTGRES_PASSWORD: signage_secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://signage:signage_secret@postgres:5432/signage?sslmode=disable
      MEDIA_DIR: /app/media
      PORT: 8080
    volumes:
      - ./media:/app/media
    ports:
      - "8080:8080"

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**1.2 後端目錄結構**

```
backend/
├── cmd/server/main.go
├── internal/
│   ├── handler/         # HTTP handlers
│   ├── service/         # 業務邏輯
│   ├── repository/      # DB 存取層
│   └── model/           # 資料結構
├── migrations/          # SQL migration 檔
├── media/               # 上傳檔案（volume 掛載）
├── Dockerfile
└── go.mod
```

**1.3 實作 REST API**

所有 API 前綴 `/api/v1`，回傳 JSON，錯誤統一格式 `{"error": "message"}`。

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/v1/health | 健康檢查 |
| GET | /api/v1/devices | 列出所有設備 |
| POST | /api/v1/devices | 新增設備 |
| GET | /api/v1/playlists | 列出播放清單 |
| POST | /api/v1/playlists | 新增播放清單 |
| GET | /api/v1/playlists/:id | 取得清單詳情（含 items） |
| PUT | /api/v1/playlists/:id | 更新清單 |
| DELETE | /api/v1/playlists/:id | 刪除清單 |
| POST | /api/v1/playlists/:id/items | 新增 item 至清單 |
| DELETE | /api/v1/playlists/:id/items/:itemId | 刪除 item |
| POST | /api/v1/upload | 上傳媒體檔案 |
| GET | /api/v1/schedules | 列出排程 |
| POST | /api/v1/schedules | 新增排程 |
| DELETE | /api/v1/schedules/:id | 刪除排程 |
| GET | /ws | WebSocket 連線端點 |
| GET | /display/:deviceId | 投放端頁面（server-side render 或回傳 HTML） |

**1.4 檔案上傳規格**

- 接受: `.pptx`（已轉換的 HTML zip）、`.html`、`.jpg`、`.png`、`.gif`、`.mp4`、`.webm`
- 儲存路徑: `./media/{uuid}/{filename}`
- 回傳: `{"id": "uuid", "url": "/media/uuid/filename", "type": "image"}`
- 大小限制: 500MB（影片）、50MB（其他）

**1.5 WebSocket Hub**

實作 `internal/hub/hub.go`：

```go
// Message 類型
type MessageType string

const (
    MsgSwitchPlaylist MessageType = "SWITCH_PLAYLIST"
    MsgUpdateContent  MessageType = "UPDATE_CONTENT"
    MsgPing           MessageType = "PING"
    MsgPong           MessageType = "PONG"
)

type Message struct {
    Type      MessageType     `json:"type"`
    DeviceID  string          `json:"device_id,omitempty"`
    Payload   json.RawMessage `json:"payload,omitempty"`
    Timestamp time.Time       `json:"timestamp"`
}
```

Hub 需支援：
- 設備以 `?device_id=xxx` 連線並註冊
- 廣播訊息給特定 device_id 或所有設備
- Ping/Pong 每 30 秒一次，60 秒無回應則斷線

**1.6 排程引擎**

使用 gocron，每分鐘掃描 `schedules` 表：
- 找出當前時間符合的 schedule（比對 days_of_week、start_time、end_time）
- 若目標設備的 current playlist 不同，透過 WebSocket Hub 發送 `SWITCH_PLAYLIST`

**驗證清單 Phase 1：**
- [ ] `docker compose up` 成功啟動，postgres + backend 皆健康
- [ ] `GET /api/v1/health` 回傳 `{"status": "ok", "db": "connected"}`
- [ ] 可透過 POST /api/v1/devices 新增設備並取得 UUID
- [ ] 可上傳一個 JPG，收到正確的 URL 並能透過瀏覽器存取
- [ ] WebSocket 連線 `ws://localhost:8080/ws?device_id=test` 不斷線

---

## Phase 2 — 三種投放模式實作

### 2.1 投放端頁面（`/display/:deviceId`）

後端直接回傳一個完整的 HTML 頁面（Go template 或 embed 靜態 HTML）。

此頁面負責：
1. 連接 WebSocket（`ws://server:8080/ws?device_id={deviceId}`）
2. 根據收到的 payload 決定投放模式
3. 根據模式渲染內容

```typescript
// Payload 結構
interface SwitchPlaylistPayload {
  playlist_id: string;
  mode: 'html5_slides' | 'image_loop' | 'video_loop';
  items: PlaylistItem[];
  transition_seconds: number;
}
```

**模式一：HTML5 Slides（`html5_slides`）**

- 用 `<iframe>` 全螢幕載入每個 HTML5 投影片
- `transition_seconds` 後自動切換下一張
- 切換動畫：CSS fade（opacity 0→1，300ms）
- 支援鍵盤 ← → 手動切換（測試用）

```html
<!-- 投放端骨架 -->
<div id="slide-container" style="width:100vw;height:100vh;position:relative;background:#000">
  <iframe id="slide-a" style="..."></iframe>
  <iframe id="slide-b" style="...;opacity:0"></iframe>
</div>
```
用雙 iframe 交替（A/B 切換），避免白畫面閃爍。

**模式二：Image Loop（`image_loop`）**

- 用 `<img>` 全螢幕顯示每張圖片
- `transition_seconds` 後切換，支援 `object-fit: contain` 和 `cover` 切換（透過設定）
- 切換動畫：CSS crossfade（同樣雙 img 交替）

**模式三：Video Loop（`video_loop`）**

- 用 `<video>` 全螢幕播放，`autoplay muted loop`
- 若清單有多個影片，前一支播完自動播下一支（`ended` 事件）
- 靜音（`muted`）確保 autoplay 不被瀏覽器阻擋

**所有模式共同要求：**
- 頁面背景黑色（`background: #000`）
- 無滾動條（`overflow: hidden`）
- 與 WebSocket 斷線後自動重連（Exponential Backoff: 1s, 2s, 4s, 8s, max 30s）
- 收到 `SWITCH_PLAYLIST` 訊息立即切換內容

### 2.2 即時推播

管理後台可手動點選「立即推播」，呼叫後端 API：

```
POST /api/v1/devices/:deviceId/push
Body: { "playlist_id": "uuid" }
```

後端透過 Hub 發送 `SWITCH_PLAYLIST` 給對應設備的 WebSocket 連線。

**驗證清單 Phase 2：**
- [ ] 開兩個瀏覽器視窗：一個開 `/display/test`，一個用 Postman 或 curl
- [ ] POST push API 後，display 頁面在 1 秒內切換播放內容
- [ ] image_loop 模式：圖片依 `transition_seconds` 自動輪播，無白畫面
- [ ] video_loop 模式：影片播完自動播下一支
- [ ] html5_slides 模式：iframe 切換無黑畫面（雙 iframe A/B 交替驗證）
- [ ] 手動關閉 WebSocket（network tab 斷線）後，display 頁面自動重連

---

## Phase 3 — 管理後台（React）

### 3.1 前端目錄結構

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx      # 總覽：設備狀態、當前播放
│   │   ├── Playlists.tsx      # 播放清單管理
│   │   ├── Upload.tsx         # 媒體上傳
│   │   └── Schedules.tsx      # 排程設定
│   ├── components/
│   │   ├── PlaylistEditor.tsx # 拖拉排序 items
│   │   ├── MediaUploader.tsx  # 拖放上傳 + 進度條
│   │   └── DeviceCard.tsx     # 設備狀態卡片
│   ├── store/
│   │   └── useStore.ts        # Zustand store
│   └── api/
│       └── client.ts          # axios instance
├── Dockerfile
└── vite.config.ts
```

### 3.2 頁面功能規格

**Dashboard**
- 顯示所有設備卡片：名稱、上線狀態（WebSocket 心跳判斷）、當前播放清單名稱
- 每個設備卡片有「立即推播」下拉選單，選擇清單後推送

**Upload 頁面**
- 拖放或點選上傳，支援多檔同時上傳
- 上傳進度條（axios `onUploadProgress`）
- 上傳完成後顯示縮圖（圖片/影片）或 HTML 圖示
- 媒體庫列表，可刪除

**Playlists 頁面**
- 新增清單，選擇模式（html5_slides / image_loop / video_loop）
- 從媒體庫拖拉加入 items，可拖拉排序
- 每個 item 可設定 `duration_seconds`
- 清單建立後可點「預覽」，開新分頁顯示 `/display/preview?playlist_id=xxx`

**Schedules 頁面**
- 選擇設備 + 播放清單 + 時間區段 + 星期幾
- 列表顯示所有排程，可啟用/停用/刪除

### 3.3 Vite proxy 設定（開發模式）

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',
    '/ws': { target: 'ws://localhost:8080', ws: true },
    '/media': 'http://localhost:8080',
    '/display': 'http://localhost:8080',
  }
}
```

**驗證清單 Phase 3：**
- [ ] 可上傳 JPG、PNG、MP4 各一個，媒體庫正確顯示縮圖
- [ ] 建立 image_loop 清單，加入 3 張圖片，設定 5 秒切換
- [ ] Dashboard 點「立即推播」，display 頁面切換正確
- [ ] 排程設定後，等候到達時間，display 自動切換（或縮短排程時間測試）

---

## Phase 4 — Windows PPTX 轉換工具（Electron）

### 4.1 目錄結構

```
electron-converter/
├── src/
│   ├── main/
│   │   ├── index.ts           # Electron main process
│   │   ├── converter.ts       # PPTX 轉換邏輯
│   │   └── ipc-handlers.ts    # IPC 通訊
│   └── renderer/
│       ├── App.tsx            # UI
│       └── index.html
├── package.json
└── electron-builder.yml
```

### 4.2 轉換流程

**方案 A（推薦）：LibreOffice headless**

```typescript
// converter.ts
import { execFile } from 'child_process';
import path from 'path';

async function convertPptxToHtml(
  pptxPath: string,
  outputDir: string
): Promise<string> {
  // 呼叫 LibreOffice headless 轉 impress HTML
  await execFileAsync('soffice', [
    '--headless',
    '--convert-to', 'html',
    '--outdir', outputDir,
    pptxPath
  ]);

  // LibreOffice 輸出：{name}.html + {name}_html_files/ 資料夾
  // 需要後處理：將資源內嵌為 base64，產生自包含 HTML
  const htmlPath = path.join(outputDir, `${basename}.html`);
  return await inlineResources(htmlPath);
}
```

**方案 B（備案）：pptxgenjs 解析 + 自訂渲染**

僅在 LibreOffice 未安裝時使用，解析 PPTX XML 自行渲染，動畫效果有限但不依賴外部程式。

**自包含 HTML 後處理（inlineResources）：**
- 讀取 HTML，找出所有 `<img src="...">` 和 `<link href="...">` 
- 將本地資源讀取後 base64 編碼內嵌
- 輸出單一 `.html` 檔案（約 2-10MB）
- 此 HTML 可直接上傳到管理後台的 Upload 頁面

### 4.3 Electron UI 規格

主視窗（800x600，不可調整）：

```
┌─────────────────────────────────────┐
│  PPTX → HTML5 轉換工具              │
├─────────────────────────────────────┤
│  [拖放 PPTX 到此處或點選開啟]       │
│                                     │
│  已選擇: presentation.pptx          │
│  輸出目錄: C:\Users\...\output\     │
│  [選擇輸出目錄]                     │
│                                     │
│  LibreOffice: ✓ 已偵測 (7.6.4)     │
│                                     │
│  [開始轉換]                         │
│                                     │
│  ████████████░░░░  75%              │
│  正在處理第 3 頁...                 │
│                                     │
│  [在瀏覽器預覽] [開啟輸出資料夾]   │
│  [上傳到看板系統]  ← 輸入 Server URL│
└─────────────────────────────────────┘
```

「上傳到看板系統」功能：
- 使用者輸入後端 URL（如 `http://192.168.1.100:8080`）
- 直接呼叫 `POST /api/v1/upload` 上傳轉換後的 HTML
- 上傳成功後顯示「已上傳，可在管理後台使用」

### 4.4 electron-builder 設定

```yaml
# electron-builder.yml
appId: com.yourname.signage-converter
productName: Signage PPTX Converter
directories:
  output: dist-electron
win:
  target: nsis
  icon: assets/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

**驗證清單 Phase 4：**
- [ ] 拖入一個有圖片的 PPTX，轉換成功產生 HTML 檔
- [ ] 產生的 HTML 在瀏覽器中開啟，顯示正確（無外部依賴、圖片正確顯示）
- [ ] 「在瀏覽器預覽」功能正常開啟 HTML
- [ ] 「上傳到看板系統」成功上傳並可在管理後台媒體庫看到

---

## 整體驗證流程（SIT）

完成所有 Phase 後，執行以下端對端測試：

1. 啟動 `docker compose up`
2. 開啟管理後台 `http://localhost:3000`
3. 上傳 2 張 JPG → 建立 `image_loop` 清單 → 設定 5 秒切換
4. 上傳 1 支 MP4 → 建立 `video_loop` 清單
5. 用 Electron 工具轉換 PPTX → 上傳 → 建立 `html5_slides` 清單
6. 開新分頁 `http://localhost:8080/display/test-device`
7. 在管理後台依序推播三種清單，確認 display 頁面切換正確
8. 設定一個 5 分鐘後觸發的排程，等候自動切換

---

## 開發注意事項

**CORS：** 後端需設定允許 `http://localhost:3000` 的 CORS header（開發模式）。

**媒體路徑：** 後端在 Docker 內的 `/app/media` 對應 host 的 `./media`，URL 統一為 `/media/{uuid}/{filename}`，前端和 display 端都從此路徑存取。

**預覽端點：** `/display/preview?playlist_id=xxx` 不綁定設備，直接根據 playlist_id 顯示，供管理後台預覽用。

**錯誤處理：** Display 端若 WebSocket 未連線，應顯示上次已知的播放清單（用 localStorage 快取 last playlist）。若無快取則顯示黑畫面 + 等待連線提示。

**LibreOffice 相依：** Electron App 安裝時偵測 LibreOffice 是否存在，若否顯示提示連結引導用戶安裝。不要將 LibreOffice 打包進 Electron（體積過大）。

---

## 輸出要求

每個 Phase 完成後：
1. 輸出該 Phase 的完整目錄結構與所有關鍵檔案
2. 提供 `README.md` 記錄啟動指令與環境需求
3. 輸出驗證清單，標記哪些已通過
4. 若有技術決策偏離規格，說明原因

開始前請先確認你理解所有規格，然後從 Phase 1 開始。
