# Agent Prompt — Welcome Board Digital Signage MVP

## 角色設定

你是一位資深全端工程師，負責獨立完成一套自用數位看板（Digital Signage）系統的 MVP 開發。請嚴格按照下方規格實作，遇到技術選擇時優先選擇穩定、文件完整的方案，並在每個 Phase 完成後輸出驗證清單。

---

## 系統概述

打造一套個人自用的 Welcome Board 數位看板投放系統，包含：

1. **桌面轉換工具**（Electron + TypeScript，支援 Windows / Linux）：將 PPTX 或 HTML 轉換為自包含 FHD HTML5
2. **後端服務**（Go + PostgreSQL + Docker）：管理內容、排程、投放
3. **管理後台**（React + TypeScript）：上傳內容、設定排程、預覽
4. **投放端**（Web Browser）：直接透過瀏覽器模擬 Kiosk 顯示（預設鎖定單一 Local Preview Screen）

---

## 技術棧規格

### 桌面轉換工具（Windows / Linux）
- Runtime: Electron 28+ with TypeScript
- 轉換模式：PPTX → HTML5（LibreOffice headless）、HTML → HTML5（resource inlining）
- 輸出格式: 自包含 FHD HTML5（1920×1080 縮放、內嵌 CSS、base64 圖片）
- 打包: electron-builder，目標 Windows x64 NSIS installer + Linux AppImage，輸出至 `output/`

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
- UI: Tailwind CSS
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
**注意**：設備功能已鎖定單一 `PreviewDevice`，不支援建立第二台設備。

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/v1/health | 健康檢查 |
| GET | /api/v1/devices | 列出所有設備（固定回傳 Preview Device） |
| POST | /api/v1/devices | 新增設備（限制最多1台） |
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
| GET | / | 自動呈現 Preview Device 投放畫面 |
| GET | /display/:deviceId | 投放端頁面（Go template 生成 HTML） |

**1.4 檔案上傳規格**

- 接受: `.html`、`.htm`、`.jpg`、`.jpeg`、`.png`、`.gif`、`.svg`、`.webp`、`.bmp`、`.ico`、`.avif`、`.mp4`、`.webm`
- 儲存路徑: `./media/{filename}`
- 回傳: `{"name": "filename", "url": "/media/filename", "type": "media"}`
- 大小限制: **1 GB**（所有檔案類型統一）

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

---

## Phase 2 — 三種投放模式實作

### 2.1 投放端頁面（`/display/:deviceId` 及 `/`）

後端直接回傳一個完整的 HTML 頁面（Go 內建字串模板）。

此頁面負責：
1. 連接 WebSocket（`ws://server:8080/ws?device_id={deviceId}`）
2. 根據收到的 payload 決定投放模式
3. 根據模式渲染內容
4. **預設狀態**：當無內容推送時，會自動透過純 CSS 渲染全螢幕 **SMPTE Color Bar**
5. **斷線重連**：實作 Exponential Backoff 機制（1s, 2s, 4s, 8s, 最大 30s）。

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

**模式二：Image Loop（`image_loop`）**

- 用 `<img>` 全螢幕顯示每張圖片
- `transition_seconds` 後切換，支援 `object-fit: contain`
- 切換動畫：CSS crossfade（同樣雙 img 交替）

**模式三：Video Loop（`video_loop`）**

- 用 `<video>` 全螢幕播放，`autoplay muted loop`
- 若清單有多個影片，前一支播完自動播下一支（`ended` 事件）
- 靜音（`muted`）確保 autoplay 不被瀏覽器阻擋

**所有模式共同要求：**
- 頁面背景黑色（`background: #000`）
- 無滾動條（`overflow: hidden`）
- 收到 `SWITCH_PLAYLIST` 訊息立即切換內容

### 2.2 即時推播

管理後台可手動點選「Push」，呼叫後端 API：

```
POST /api/v1/devices/:deviceId/push
Body: { "playlist_id": "uuid" }
```

**重要**：這是一套 Push 架構，若投放網頁在伺服器發送 Push 時尚未開啟，將不會收到更新。必須先開啟 `http://localhost:8080/` 讓畫面顯示 Color Bar，再從後台進行推播。

---

## Phase 3 — 管理後台（React）

### 3.1 前端目錄結構

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx      # 總覽：推播控制與設備資訊（附 Toast 通知）
│   │   ├── Playlists.tsx      # 播放清單管理（預設 5s 切換，含 Preview 按鈕）
│   │   ├── Upload.tsx         # 媒體上傳（支援 Drag & Drop）
│   │   └── Schedules.tsx      # 排程設定
│   ├── components/
│   ├── store/
│   │   └── useStore.ts        # Zustand store (需做好空陣列保護)
│   └── api/
│       └── client.ts          # axios instance
├── Dockerfile
└── vite.config.ts
```

### 3.2 頁面功能規格

**管理後台 Header（App.tsx）**
- "Welcome Board Admin" 標題：`font-black`，Daylight 模式藍黑漸層（`from-blue-900 to-slate-900`），Dark 模式青綠漸層（`from-blue-400 to-emerald-400`）
- 第一列：Logo（左）/ 標題（中）/ 深淺切換（右）；第二列分隔線後置中顯示導覽列（Dashboard / Playlists / Upload / Schedules）

**Dashboard**
- 僅顯示單一 Preview Device 的資訊。
- 可直接從下拉選單選擇 Playlist 並進行推播。
- 採用畫面底部的 Toast 通知取代傳統的 alert()。

**Upload 頁面**
- 支援檔案拖放 (Drag & Drop) 與點擊上傳。
- 接受格式：HTML5、JPG、PNG、GIF、SVG、WebP、AVIF、BMP、MP4、WebM。單檔上限 1 GB。
- 上傳進度條（axios `onUploadProgress`）。
- 媒體庫預覽：圖片 → `<img>`，影片 → `<video>`，HTML → `<iframe>` 縮圖預覽（沙盒模式）。
- 媒體庫列表可刪除。

**Playlists 頁面**
- 新增清單，選擇模式（html5_slides / image_loop / video_loop）。
- 將媒體加入 items，預設 transition 與 duration 調整為 **5秒**。
- 提供 `Preview on Display` 按鈕，可將所選清單一鍵推播至 Preview Screen。

**Schedules 頁面**
- 選擇播放清單 + 時間區段 + 星期幾。
- 列表顯示所有排程，可刪除。

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

---

## Phase 4 — 桌面轉換工具（Electron，Windows / Linux）

### 4.1 轉換模式

**PPTX → HTML5（LibreOffice headless）**

```typescript
// converter.ts — convertPptxLibreOffice()
await execFileAsync(sofficePath, [
  '--headless', '--convert-to', 'html', '--outdir', outputDir, pptxPath
], { timeout: 120000 });
// 再執行 inlineResources() 內嵌所有本地 CSS / 圖片，注入 FHD 縮放
```

LibreOffice 自動搜尋路徑：Windows `Program Files`、Linux `/usr/bin/soffice`、`/usr/lib/libreoffice/...`、環境變數 `LIBREOFFICE_PATH`。

**HTML → HTML5（convertHtmlToHtml5）**
- 直接對現有 HTML 執行 `inlineResources()` + FHD 縮放注入
- 不需要 LibreOffice

**自包含 HTML 後處理（inlineResources）：**
- 讀取 HTML，找出所有 `<img src="...">` 和 `<link href="...">`
- 將本地資源讀取後 base64 編碼內嵌
- 注入 FHD (1920×1080) 縮放 CSS + JS
- 輸出單一 `_fhd_standalone.html`（約 2–10 MB）

### 4.2 Electron UI 規格

- Hero 區塊提供模式切換按鈕：**PPTX → HTML5** / **HTML → HTML5**
- 模式切換時自動更新拖放區提示、檔案過濾器、LibreOffice badge 顯示
- 「上傳到看板系統」：輸入後端 URL（如 `http://localhost:8080`），呼叫 `POST /api/v1/upload`

### 4.3 打包

```bash
npm run dist        # Windows NSIS installer
npm run dist:linux  # Linux AppImage
npm run dist:all    # 同時產生兩平台
```

輸出至 `electron-converter/output/`。

---

## 整體驗證流程（SIT）

完成所有 Phase 後，執行以下端對端測試：

1. 啟動 `docker compose up --build -d`
2. 開啟 Display Screen `http://localhost:8080/` (應顯示 Color Bar)
3. 開啟管理後台 `http://localhost:3000`
4. 進入 Upload 拖放 2 張 JPG 上傳。
5. 建立 `image_loop` 清單，設定 5 秒切換。
6. 點擊 Dashboard 將該清單 Push 給設備。
7. 確認 Display Screen 順利切換為圖片輪播。

---

## 開發注意事項

**CORS：** 後端需設定允許 `http://localhost:3000` 的 CORS header（開發模式）。
**錯誤處理：** 留意資料庫為空時回傳空陣列 `[]` 而非 `null`，避免前端 map() 渲染崩潰。
**跨平台兼容：** 取得 System Storage 使用量時，需區分 OS 實作 (Windows / Linux) 避免編譯錯誤。
