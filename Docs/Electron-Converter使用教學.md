# Signage Converter 使用教學

**工具名稱：** Signage Converter v1.0.0  
**對象：** MIS 人員 / 內容製作人員  
**更新：** 2026-04

---

## 目錄

1. [工具用途](#1-工具用途)
2. [環境需求](#2-環境需求)
3. [取得執行檔](#3-取得執行檔)
4. [操作流程：PPTX → HTML5](#4-操作流程pptx--html5)
5. [操作流程：HTML → HTML5](#5-操作流程html--html5)
6. [上傳到看板系統](#6-上傳到看板系統)
7. [LibreOffice 安裝與路徑設定](#7-libreoffice-安裝與路徑設定)
8. [輸出檔案說明](#8-輸出檔案說明)
9. [從原始碼自行建置](#9-從原始碼自行建置)

---

## 1. 工具用途

Signage Converter 是一款**桌面應用程式**，用於將常見的簡報或網頁素材轉換為適合數位看板播放的自包含 HTML5 格式：

| 轉換模式 | 輸入格式 | 輸出格式 | 說明 |
|----------|----------|----------|------|
| **PPTX → HTML5** | `.pptx` / `.ppt` | 自包含 HTML5 | 透過 LibreOffice 將簡報轉為 HTML，再內嵌所有圖片與樣式 |
| **HTML → HTML5** | `.html` / `.htm` | 自包含 HTML5 | 將現有 HTML 的外部圖片、CSS 全部 base64 內嵌，輸出單一 HTML 檔案 |

輸出的 HTML5 檔案：
- **零外部依賴**（所有資源內嵌）
- **自動套用 FHD 縮放**（1920×1080，比例自適應螢幕）
- 可直接上傳至 Welcome Board 看板系統

---

## 2. 環境需求

### Windows

| 項目 | 需求 | 說明 |
|------|------|------|
| 作業系統 | Windows 10 x64 以上 | |
| LibreOffice 7.x | **選配**（PPTX 模式建議安裝） | 未安裝時 PPTX 模式使用備用方案，品質較低 |

### Linux（Ubuntu）

| 項目 | 需求 | 說明 |
|------|------|------|
| 作業系統 | Ubuntu 20.04 以上 | |
| FUSE | 已安裝（執行 AppImage 需要） | 執行 `sudo apt install libfuse2` |
| LibreOffice 7.x | **選配** | 同上 |

---

## 3. 取得執行檔

執行檔位於專案目錄的 `electron-converter/output/` 資料夾：

### Windows

| 檔案 | 說明 |
|------|------|
| `Signage Converter Setup 1.0.0.exe` | NSIS 安裝程式（建議，可選安裝路徑） |
| `Signage Converter-1.0.0-win.zip` | 免安裝版（解壓縮直接執行） |

**安裝步驟（NSIS 版）：**

1. 雙擊 `Signage Converter Setup 1.0.0.exe`
2. 選擇安裝目錄（預設 `C:\Program Files\Signage Converter`）
3. 點選「Install」
4. 安裝完成後桌面會出現捷徑，或從開始選單搜尋「Signage Converter」

### Linux（Ubuntu）

```bash
# 找到 AppImage 檔案
ls electron-converter/output/*.AppImage

# 賦予執行權限
chmod +x "electron-converter/output/Signage Converter-1.0.0.AppImage"

# 執行
./"electron-converter/output/Signage Converter-1.0.0.AppImage"
```

> **提示**：若出現 `FUSE not available` 錯誤，請執行 `sudo apt install libfuse2` 後再試。

---

## 4. 操作流程：PPTX → HTML5

### 步驟一：確認模式為「PPTX → HTML5」

開啟 Signage Converter 後，工具列顯示兩個模式切換按鈕。確認選擇的是 **「PPTX → HTML5」**（按鈕呈現選中狀態）。

畫面上方會顯示 LibreOffice 偵測狀態：
- ✅ **已偵測到 LibreOffice X.X.X** — 最佳轉換品質
- ⚠️ **未偵測到 LibreOffice** — 將使用備用模式，簡報內容可能不完整

### 步驟二：選取 PPTX 檔案

方式一：**拖曳** `.pptx` 或 `.ppt` 檔案到工具的拖放區。

方式二：**點選拖放區**，在檔案選擇對話框中選取檔案。

選取後，畫面顯示檔案路徑即表示選取成功。

### 步驟三：選擇輸出目錄

點選「**選擇輸出目錄**」按鈕，選取要儲存 HTML5 輸出檔案的資料夾。

> **建議**：選擇桌面或專用的「轉換輸出」資料夾，方便事後上傳。

### 步驟四：開始轉換

點選「**開始轉換**」按鈕，進度條顯示轉換狀態：

| 進度 | 訊息 |
|------|------|
| 0% | Starting LibreOffice... |
| 10% | Converting PPTX → HTML... |
| 60% | Inlining resources (images, styles)... |
| 90% | Writing standalone file... |
| 100% | Done! |

轉換時間依簡報大小而定，通常 **10–60 秒**。

### 步驟五：確認輸出結果

轉換完成後，下方顯示成功訊息與輸出路徑，例如：

```
輸出：C:\Users\mis\Desktop\報告_fhd_standalone.html
```

### 步驟六：後續操作

成功後顯示三個按鈕：

| 按鈕 | 說明 |
|------|------|
| 🌐 **在瀏覽器預覽** | 以預設瀏覽器開啟 HTML5 確認效果 |
| 📂 **開啟輸出資料夾** | 開啟 Windows 檔案總管到輸出目錄 |
| ☁ **上傳到看板系統** | 一鍵上傳至後端（詳見[第 6 章](#6-上傳到看板系統)） |

---

## 5. 操作流程：HTML → HTML5

適用於已有 HTML 素材（例如：行銷網頁、活動頁面），將其外部資源全部內嵌為自包含檔案。

### 步驟一：切換到「HTML → HTML5」模式

點選工具列「**HTML → HTML5**」按鈕切換模式。

LibreOffice 偵測徽章會隱藏（HTML 模式不需要 LibreOffice）。

### 步驟二：選取 HTML 檔案

拖曳或點選 `.html` / `.htm` 檔案到拖放區。

> **重要**：HTML 檔案的**外部圖片和 CSS**（位於同一資料夾或子資料夾的本機檔案）會一起被內嵌。請確保 HTML 檔案與其依賴資源放在同一目錄。

### 步驟三：選擇輸出目錄

同 PPTX 模式，點選「選擇輸出目錄」。

### 步驟四：開始轉換

點選「**開始轉換**」，進度較快（無 LibreOffice 轉換步驟）：

| 進度 | 訊息 |
|------|------|
| 10% | Reading HTML file... |
| 40% | Inlining resources (images, styles)... |
| 100% | Done! |

### 步驟五：預覽與上傳

同 PPTX 模式，可選擇「在瀏覽器預覽」或「上傳到看板系統」。

---

## 6. 上傳到看板系統

### 前提條件

- Welcome Board Docker 服務已正常運作（http://localhost:8080/api/v1/health 可存取）
- 已完成轉換，輸出了 `_fhd_standalone.html` 檔案

### 操作步驟

1. 轉換完成後，點選「**☁ 上傳到看板系統**」
2. 彈出對話框，確認或修改「Server URL」（預設 `http://localhost:8080`）
3. 點選確認，工具自動上傳檔案
4. 上傳成功後顯示確認訊息

### 確認上傳結果

1. 開啟管理後台 http://localhost:3000
2. 點選「**Upload**」頁面
3. 媒體庫中應出現新上傳的 `.html` 檔案
4. 可將其加入播放清單後推播到顯示器

---

## 7. LibreOffice 安裝與路徑設定

### 安裝 LibreOffice（Windows）

1. 前往 [LibreOffice 官網](https://www.libreoffice.org/download/)
2. 下載「LibreOffice 7.x Windows x64」安裝程式
3. 依照安裝精靈完成安裝（預設路徑即可）
4. 重新啟動 Signage Converter，應顯示「已偵測到 LibreOffice」

### 安裝 LibreOffice（Ubuntu）

```bash
sudo apt update
sudo apt install libreoffice
```

### 自動偵測路徑

工具依序搜尋以下路徑：

**Windows：**
```
C:\Program Files\LibreOffice\program\soffice.exe
C:\Program Files (x86)\LibreOffice\program\soffice.exe
```

**Linux：**
```
/usr/bin/soffice
/usr/lib/libreoffice/program/soffice
/opt/libreoffice/program/soffice
```

### 手動指定路徑（環境變數）

若 LibreOffice 安裝在非標準路徑，可設定環境變數：

**Windows（命令提示字元）：**
```cmd
set LIBREOFFICE_PATH=D:\tools\LibreOffice\program\soffice.exe
```

**Windows（永久設定）：**
控制台 → 系統 → 進階系統設定 → 環境變數 → 新增 `LIBREOFFICE_PATH`

**Linux：**
```bash
export LIBREOFFICE_PATH=/custom/path/to/soffice
```

---

## 8. 輸出檔案說明

### 命名規則

| 輸入檔名 | 輸出檔名 |
|----------|----------|
| `公司介紹.pptx` | `公司介紹_fhd_standalone.html` |
| `landing_page.html` | `landing_page_fhd_standalone.html` |
| `presentation.ppt`（無 LibreOffice） | `presentation_fhd_preview.html`（備用） |

### FHD 縮放機制

輸出的 HTML5 檔案內含自動縮放腳本：

- 基準解析度：**1920 × 1080**
- 在任何尺寸的瀏覽器 / 螢幕上，內容等比例縮放置中
- 無黑邊（`object-fit: contain` 概念）

### 檔案大小

- 一般含圖片的 PPTX（10–20 張）：**2–15 MB**
- 圖片少的 HTML 頁面：**200 KB–2 MB**

---

## 9. 從原始碼自行建置

適用於需要修改工具或在新環境打包的 MIS 人員。

### 環境需求

- Node.js 18+
- npm 9+

### 步驟

```bash
cd electron-converter

# 安裝依賴
npm install

# 開發模式（即時編譯 + 啟動 Electron）
npm start

# 打包 Windows 執行檔（.exe + .zip）
npm run dist

# 打包 Linux 執行檔（.AppImage）
# 必須在 Linux 或 WSL2 環境執行
npm run dist:linux

# 同時打包 Windows + Linux
npm run dist:all
```

輸出檔案位於 `electron-converter/output/` 目錄。

> **注意**：Linux AppImage 必須在 Linux 環境（或 WSL2）下建置，無法在 Windows 上交叉編譯。

---

*如有問題請聯繫系統負責人或參考《[MIS 操作手冊](./MIS操作手冊.md)》。*
