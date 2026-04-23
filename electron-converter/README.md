# Signage Converter

Windows / Linux 桌面工具 — 將 **PPTX** 或 **HTML** 轉換為自包含 FHD HTML5，可直接上傳至 Welcome Board 看板系統。

## 轉換模式

| 模式 | 說明 |
|------|------|
| PPTX → HTML5 | 透過 LibreOffice headless 將 PowerPoint 轉為 HTML，再內嵌所有資源並套用 FHD 縮放 |
| HTML → HTML5 | 讀取現有 HTML 檔，將本地 CSS / 圖片全部 base64 內嵌，輸出為自包含 FHD HTML5 |

## 環境需求

- Node.js 18+
- npm 9+
- （PPTX 模式建議）LibreOffice 7.x ([下載](https://www.libreoffice.org/download/)) — 安裝後可獲得最佳轉換品質；未安裝時自動切換備用模式

## 快速啟動（開發模式）

```bash
cd electron-converter

# 安裝依賴
npm install

# 編譯並啟動 Electron
npm start
```

> **注意**：`npm start` 會先 build TypeScript，再啟動 Electron。

## 開發熱重載模式

```bash
# Terminal 1 — 監聽 TypeScript 變化
npx tsc -p tsconfig.main.json --watch

# Terminal 2 — 啟動 Electron（等 dist 生成後）
electron .
```

## 打包成執行檔

```bash
# Windows (.exe NSIS installer)
npm run dist

# Ubuntu Linux (.AppImage)
npm run dist:linux

# 同時打包 Windows + Linux
npm run dist:all
```

輸出至 `output/` 目錄。

## 功能說明

| 功能 | 說明 |
|------|------|
| 模式切換 | PPTX → HTML5 / HTML → HTML5 兩種模式可切換 |
| 拖放輸入 | 支援拖放或點選開啟（PPTX 或 HTML 依模式切換） |
| LibreOffice 偵測 | PPTX 模式下自動偵測系統 LibreOffice 安裝 |
| 自包含 HTML | 圖片、CSS 全部 base64 內嵌，零外部依賴 |
| FHD 縮放 | 自動注入 1920×1080 縮放 CSS + JS |
| 瀏覽器預覽 | 直接在預設瀏覽器開啟 HTML |
| 上傳看板系統 | 一鍵上傳至後端 `/api/v1/upload` |

## LibreOffice 自動搜尋路徑

**Windows：**
- `C:\Program Files\LibreOffice\program\soffice.exe`
- `C:\Program Files (x86)\LibreOffice\program\soffice.exe`

**Linux：**
- `/usr/bin/soffice`
- `/usr/lib/libreoffice/program/soffice`
- `/opt/libreoffice/program/soffice`

**共用：**
- 環境變數 `LIBREOFFICE_PATH`

## 驗證清單

- [ ] PPTX 模式：拖入有圖片的 PPTX，轉換成功產生 `_fhd_standalone.html`
- [ ] HTML 模式：拖入含外部 CSS / 圖片的 HTML，轉換成功產生 `_fhd_standalone.html`
- [ ] 產生的 HTML 在瀏覽器開啟，圖片正確顯示且無外部依賴
- [ ] 「在瀏覽器預覽」功能正常開啟 HTML
- [ ] 「上傳到看板系統」成功上傳並可在管理後台媒體庫看到
- [ ] Windows 打包：`npm run dist` 產生 NSIS installer 於 `output/`
- [ ] Linux 打包：`npm run dist:linux` 產生 AppImage 於 `output/`
