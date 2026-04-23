# Welcome Board Digital Signage MVP

這是一套為數位看板（Digital Signage）打造的投放系統 MVP。包含了可將 PPTX 轉換為 HTML5 的 Windows 桌面工具、負責管理排程與派送內容的 Go 後端服務，以及 React 管理後台介面。

## 專案結構

- `docker-compose.yml`: 一鍵啟動後端與前端服務的設定檔。
- `backend/`: Go 語言撰寫的後端 API 與 WebSocket 服務。負責資料庫存取、檔案管理與排程推播。
- `frontend/`: React + TypeScript 撰寫的管理後台。負責上傳媒體、設定播放清單與排程設定。
- `electron-converter/`: Electron + TypeScript 撰寫的 Windows 桌面應用程式。用於將 PPTX 轉換成可獨立執行的 HTML5 投影片，並能上傳至後端。
- `media/`: 存放上傳媒體檔案的資料夾（由 Docker Volume 自動掛載）。

## 系統需求

在開始測試前，請確保你的電腦已安裝以下環境：
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (用於啟動前後端服務與資料庫)
- [Node.js](https://nodejs.org/) (用於執行 Electron 桌面轉換工具)

---

## 啟動與測試步驟

### 第一步：啟動 Web 系統 (後端服務 + 管理後台)

專案已經完全容器化，你只需要透過 Docker Compose 即可將資料庫、後端 API 與前端管理介面一併啟動。

1. 開啟終端機 (PowerShell 或命令提示字元)。
2. 切換到專案根目錄 (`TN_Welcomeboard`)。
3. 執行以下指令來建立並啟動所有容器（`-d` 參數讓服務在背景執行）：

```bash
docker-compose up --build -d
```

> **注意：** 第一次啟動時，Docker 會需要一些時間下載映像檔 (PostgreSQL、Go、Node) 並編譯程式碼，請耐心等候。

### 第二步：驗證 Web 系統

容器啟動完成後，你可以打開瀏覽器進行測試：

1. **管理後台 (Frontend)**: 前往 [http://localhost:3000](http://localhost:3000)
   - 你會看到使用 React 與 TailwindCSS 建立的「Welcome Board Admin」首頁介面。
2. **後端 API 狀態**: 前往 [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
   - 如果後端與資料庫連線正常，你會看到以下 JSON 回傳：`{"db":"connected","status":"ok"}`。

### 第三步：測試 Windows 桌面轉換工具 (Electron)

1. 開啟另一個終端機。
2. 切換到轉換工具的目錄：
   ```bash
   cd electron-converter
   ```
3. 安裝依賴套件（如果你還沒安裝過的話）：
   ```bash
   npm install
   ```
4. 啟動 Electron 應用程式：
   ```bash
   npm start
   ```
   - 這將會打開一個桌面視窗，你可以在此將 PPTX 轉換為 HTML5 並預期能夠與我們剛剛啟動的後端系統連動。

---

## 關閉系統

如果你測試完畢，想要停止這些背景執行的 Docker 容器，請在專案根目錄執行：

```bash
docker-compose down
```

如果想要在關閉時順便清除資料庫的資料，可以加上 `-v` 參數：
```bash
docker-compose down -v
```
