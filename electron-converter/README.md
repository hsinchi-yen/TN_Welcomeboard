# Signage PPTX Converter

Windows 桌面工具 — 將 PPTX 轉換為自包含 HTML5，可直接上傳至 Welcome Board 看板系統。

## 環境需求

- Node.js 18+
- npm 9+
- （建議）LibreOffice 7.x ([下載](https://www.libreoffice.org/download/)) — 安裝後可獲得最佳轉換品質

## 快速啟動（開發模式）

```bash
cd electron-converter

# 安裝依賴
npm install

# 編譯並啟動 Electron
npm start
```

> **注意**：`npm start` 會先 build TypeScript，再啟動 Electron。
> 若 LibreOffice 未安裝，工具會自動切換備用模式（生成簡易 HTML）。

## 開發熱重載模式

需要兩個終端機同時運行：

```bash
# Terminal 1 — 監聽 TypeScript 變化
npx tsc -p tsconfig.main.json --watch

# Terminal 2 — 啟動 Electron（等 dist 生成後）
electron .
```

## 打包成 Installer

```bash
npm run dist
# 輸出至 dist-electron/ 目錄
```

## 功能說明

| 功能 | 說明 |
|------|------|
| 拖放 PPTX | 支援拖放或點選開啟 |
| LibreOffice 偵測 | 自動偵測系統 LibreOffice 安裝 |
| 自包含 HTML | 圖片、CSS 全部 base64 內嵌 |
| 瀏覽器預覽 | 直接在預設瀏覽器開啟 HTML |
| 上傳看板系統 | 一鍵上傳至後端 `/api/v1/upload` |

## LibreOffice 安裝路徑

工具自動搜尋以下路徑：
- `C:\Program Files\LibreOffice\program\soffice.exe`
- `C:\Program Files (x86)\LibreOffice\program\soffice.exe`
- 環境變數 `LIBREOFFICE_PATH`

## 驗證清單

- [ ] 拖入一個有圖片的 PPTX，轉換成功產生 HTML 檔
- [ ] 產生的 HTML 在瀏覽器中開啟，顯示正確（無外部依賴、圖片正確顯示）
- [ ] 「在瀏覽器預覽」功能正常開啟 HTML
- [ ] 「上傳到看板系統」成功上傳並可在管理後台媒體庫看到
