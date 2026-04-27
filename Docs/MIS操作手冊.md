# TN Welcome Board 數位看板系統 — MIS 操作手冊

**版本：** 1.0　**對象：** MIS / IT 維運人員　**更新：** 2026-04

---

## 目錄

1. [系統架構概覽](#1-系統架構概覽)
2. [環境需求](#2-環境需求)
3. [首次部署（Docker）](#3-首次部署docker)
4. [日常維護指令](#4-日常維護指令)
5. [管理後台操作](#5-管理後台操作)
6. [投放畫面說明](#6-投放畫面說明)
7. [支援格式對照表](#7-支援格式對照表)
8. [常見問題排解](#8-常見問題排解)

---

## 1. 系統架構概覽

系統由三個元件組成：

| 元件 | 技術 | 說明 |
|------|------|------|
| **Backend** | Go + PostgreSQL | REST API、WebSocket、排程引擎 |
| **Frontend** | React + Nginx | 管理後台 Web UI |
| **Electron Converter** | Electron（桌面工具） | 將 PPTX / HTML 轉為自包含 HTML5，不在 Docker 中執行 |

### 服務端口對應

| 服務 | URL | 說明 |
|------|-----|------|
| 管理後台 | http://localhost:3000 | MIS 人員操作介面 |
| 投放畫面 / API | http://localhost:8080 | 顯示器播放頁面、後端 API |
| 健康檢查 | http://localhost:8080/api/v1/health | 確認後端運作正常 |
| 資料庫 | localhost:5432 | PostgreSQL（僅內部使用） |

### 資料流概念圖

```
[MIS 管理後台 :3000]
        │ 上傳媒體、建立播放清單、設定排程、手動推播
        ▼
[Backend API :8080] ──── WebSocket ────► [瀏覽器投放畫面 :8080]
        │                                         ▲
        │ 讀寫                            排程自動切換播放清單
        ▼
[PostgreSQL :5432]

[Electron Converter（本機）] ──上傳 HTML5──► [Backend API :8080]
```

---

## 2. 環境需求

### Docker 服務（必要）

| 軟體 | 最低版本 | 說明 |
|------|----------|------|
| Docker Desktop | 4.x 以上 | Windows / Linux 均可 |
| Docker Compose | V2 (compose plugin) | 已內建於 Docker Desktop |

> **注意**：Windows 上請確認 Docker Desktop 已啟動，並且切換為 **Linux 容器模式**（預設即是）。

### Electron Converter（本機工具，非必要）

- LibreOffice 7.x — 若需要 PPTX → HTML5 轉換功能（可選）
- 詳見《[Electron Converter 使用教學](./Electron-Converter使用教學.md)》

---

## 3. 首次部署（Docker）

### 3.1 取得專案

```bash
git clone <repo-url> TN_Welcomeboard
cd TN_Welcomeboard
```

或直接解壓縮專案資料夾。

### 3.2 專案目錄結構

```
TN_Welcomeboard/
├── docker-compose.yml    ← 核心設定檔
├── backend/              ← Go 後端（含 Dockerfile）
├── frontend/             ← React 前端（含 Dockerfile）
├── media/                ← 上傳媒體的實體儲存位置（自動建立）
├── electron-converter/   ← 桌面轉換工具（不在 Docker 中）
└── Docs/                 ← 說明文件
```

### 3.3 啟動服務

在專案根目錄執行以下指令（**第一次會自動 build，約需 3–5 分鐘**）：

```bash
docker compose up --build -d
```

| 參數 | 說明 |
|------|------|
| `--build` | 重新建置 Docker Image（第一次或程式碼更新後使用） |
| `-d` | 背景執行（detached mode） |

### 3.4 確認服務啟動成功

服務啟動順序：`postgres` → `backend` → `frontend`（有 health check 保護）

**方法一：查看容器狀態**

```bash
docker compose ps
```

所有服務的 `STATUS` 欄位應顯示 `Up`（或 `healthy`）：

```
NAME                    STATUS
tn_welcomeboard-postgres-1    Up (healthy)
tn_welcomeboard-backend-1     Up (healthy)
tn_welcomeboard-frontend-1    Up
```

**方法二：瀏覽器確認**

開啟 http://localhost:8080/api/v1/health，若回傳以下內容即表示正常：

```json
{"status":"ok","database":"connected"}
```

開啟 http://localhost:3000，應顯示管理後台首頁。

### 3.5 首次設定：建立播放裝置

系統預設已有一台虛擬裝置（Preview Device），無需手動建立，直接開啟 Dashboard 即可使用。

---

## 4. 日常維護指令

以下指令均在專案根目錄（`docker-compose.yml` 所在位置）執行。

### 4.1 啟動 / 停止 / 重啟

```bash
# 啟動所有服務（不重新 build）
docker compose up -d

# 停止所有服務（不刪除資料）
docker compose stop

# 重啟所有服務
docker compose restart

# 完全停止並移除容器（資料保留於 postgres_data volume）
docker compose down
```

### 4.2 查看 Logs

```bash
# 查看所有服務日誌（即時）
docker compose logs -f

# 只看 backend 日誌
docker compose logs -f backend

# 只看最後 100 行
docker compose logs --tail=100 backend
```

### 4.3 程式碼更新後重新部署

```bash
git pull
docker compose up --build -d
```

### 4.4 資料備份（媒體檔案）

上傳的媒體檔案儲存於專案目錄的 `media/` 資料夾，直接備份此資料夾即可。

資料庫資料存於 Docker volume `postgres_data`，如需備份：

```bash
docker exec tn_welcomeboard-postgres-1 pg_dump -U signage signage > backup.sql
```

---

## 5. 管理後台操作

開啟 http://localhost:3000 進入管理後台。

### 5.1 媒體庫（上傳頁面）

**功能說明：**
- 上傳圖片、影片、HTML5 素材
- 瀏覽已上傳的媒體清單（含預覽縮圖）
- 刪除不需要的媒體
- 查看磁碟使用量

**操作步驟：**

1. 點選頂部導覽列「**Upload**」
2. 拖曳檔案至上傳區，或點選「選擇檔案」
3. 等待上傳進度條完成
4. 媒體庫下方即顯示已上傳的檔案

**上傳限制：**
- 最大單檔：**1 GB**
- 支援格式詳見 [第 7 章](#7-支援格式對照表)

---

### 5.2 播放清單（Playlists）

**功能說明：**
- 建立多個播放清單
- 將媒體素材加入清單，設定播放秒數
- 支援三種播放模式

**建立播放清單步驟：**

1. 點選「**Playlists**」
2. 點選「**新增播放清單**」
3. 輸入清單名稱，選擇播放模式：

| 模式 | 適用格式 | 說明 |
|------|----------|------|
| **HTML5 Slides** | `.html` / `.htm` | 全螢幕顯示 HTML5 投影片，依設定秒數自動翻頁 |
| **Image Loop** | 圖片（jpg/png/gif 等） | 圖片依序循環播放，含淡入淡出效果 |
| **Video Loop** | `.mp4` / `.webm` | 影片循環播放，多支影片依序接續 |

4. 點選「**新增素材**」，從媒體庫選取檔案
5. 設定每個素材的「顯示秒數」（預設 5 秒）
6. 可拖曳調整素材順序
7. 儲存清單

---

### 5.3 排程（Schedules）

**功能說明：**
- 設定在特定時段自動切換到指定播放清單

**建立排程步驟：**

1. 點選「**Schedules**」
2. 點選「**新增排程**」
3. 設定以下欄位：

| 欄位 | 說明 | 範例 |
|------|------|------|
| 裝置 | 選擇投放裝置 | Preview Device |
| 播放清單 | 選擇要播放的清單 | 產品介紹 |
| 開始時間 | 每日開始播放時刻 | 09:00 |
| 結束時間 | 每日停止播放時刻 | 18:00 |
| 星期 | 勾選生效日（可多選） | 週一 ～ 週五 |

4. 儲存排程後系統每分鐘自動檢查，到時段自動推播

> **注意**：排程自動推播時，**投放畫面的瀏覽器必須已開啟**，否則將在下次開啟時顯示。

---

### 5.4 手動推播（Dashboard）

**操作步驟：**

1. 點選「**Dashboard**」
2. 在裝置卡片的下拉選單選擇要播放的「播放清單」
3. 點選「**Push**」按鈕
4. 右側即時預覽框會立即切換到該播放清單
5. 投放畫面（http://localhost:8080）同步更新

> **注意**：推播為**即時點對點**，只有當下已開啟 http://localhost:8080 的瀏覽器才會收到更新；關閉後再開啟不會重新推播，請重新 Push 一次。

---

## 6. 投放畫面說明

### 開啟投放畫面

在連接顯示器的電腦上，以瀏覽器（建議 Chrome / Edge）開啟：

```
http://localhost:8080
```

並設定為**全螢幕（F11）**。

### 預設畫面

若尚未推播任何播放清單，畫面顯示 **SMPTE 色條**（測試畫面），中央有 TechNexion logo，屬正常現象。

### 三種播放模式行為

| 模式 | 切換方式 | 特效 |
|------|----------|------|
| HTML5 Slides | 依「顯示秒數」自動翻頁 | 淡入淡出（300ms） |
| Image Loop | 依「顯示秒數」自動切圖 | CSS 淡入淡出 |
| Video Loop | 影片播完自動接下一支 | 無（影片結束即切換） |

### WebSocket 斷線重連

投放畫面透過 WebSocket 與後端保持連線；若網路短暫中斷，會自動以指數退避方式重試（1s → 2s → 4s → 最長 30s），**不需要手動重新整理頁面**。

---

## 7. 支援格式對照表

| 副檔名 | 類型 | 播放模式 |
|--------|------|----------|
| `.html` `.htm` | HTML5 | HTML5 Slides |
| `.jpg` `.jpeg` | 圖片 | Image Loop |
| `.png` | 圖片 | Image Loop |
| `.gif` | 圖片（動態） | Image Loop |
| `.svg` | 向量圖 | Image Loop |
| `.webp` | 圖片 | Image Loop |
| `.bmp` | 圖片 | Image Loop |
| `.ico` | 圖示 | Image Loop |
| `.avif` | 圖片 | Image Loop |
| `.mp4` | 影片 | Video Loop |
| `.webm` | 影片 | Video Loop |

**上傳限制：** 最大 **1 GB** / 單檔

---

## 8. 常見問題排解

### Q1：執行 `docker compose up` 後容器狀態顯示 `Restarting`

**原因：** 通常是 PostgreSQL 尚未就緒，backend 連線失敗。

**解法：**
```bash
# 查看 backend 日誌
docker compose logs backend

# 等待約 30 秒後重新確認狀態
docker compose ps
```

若持續失敗，嘗試完整重建：
```bash
docker compose down
docker compose up --build -d
```

---

### Q2：上傳失敗，頁面顯示錯誤

**可能原因：**
- 檔案格式不在支援清單中
- 檔案大小超過 1 GB
- 後端服務未正常運作

**解法：**
1. 確認格式符合[支援清單](#7-支援格式對照表)
2. 確認檔案小於 1 GB
3. 開啟 http://localhost:8080/api/v1/health 確認後端正常

---

### Q3：推播後投放畫面沒有切換

**可能原因：**
- 投放畫面的瀏覽器在推播前未開啟
- WebSocket 連線中斷

**解法：**
1. 確認 http://localhost:8080 瀏覽器是開啟的
2. 重新整理投放畫面後，再次點選「Push」
3. 查看瀏覽器開發者工具 Console，確認 WebSocket 連線狀態

---

### Q4：媒體檔案上傳成功，但播放清單無法看到

**解法：**
1. 確認播放清單的「模式」與媒體格式相符（例如：Video Loop 只支援 mp4/webm）
2. 重新整理管理後台頁面

---

### Q5：如何完全清除所有資料重新開始

```bash
# 停止並移除容器、網路、volume（⚠️ 資料庫資料將全部刪除）
docker compose down -v

# 重新啟動
docker compose up --build -d
```

> **警告**：`-v` 參數會刪除 PostgreSQL 的所有資料，操作前請確認已備份。

---

*如有問題請聯繫系統負責人。*
