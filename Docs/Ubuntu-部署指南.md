# TN Welcome Board — Ubuntu Linux 部署指南

> 適用：Ubuntu 22.04 LTS / 24.04 LTS（伺服器或桌面版皆可）  
> 假設：Docker 與 Docker Compose 已安裝完成

---

## 1. 傳輸專案檔案

### 方法 A：Git（推薦）
```bash
git clone <your-repo-url> /opt/tn-welcomeboard
cd /opt/tn-welcomeboard
```

### 方法 B：從 Windows 用 rsync/scp 複製
```bash
# 在 Windows PowerShell（或 WSL）執行
rsync -avz --exclude 'electron-converter/output' \
  --exclude 'electron-converter/node_modules' \
  --exclude 'node_modules' \
  /mnt/d/TN_Tool_Projects/TN_Welcomeboard/ \
  user@ubuntu-server:/opt/tn-welcomeboard/
```

### 方法 C：ZIP 壓縮後上傳
```bash
# Ubuntu 端解壓
unzip tn-welcomeboard.zip -d /opt/tn-welcomeboard
```

---

## 2. 修正 Windows 換行符號（CRLF → LF）

Windows 上編輯的文字檔可能帶有 `\r\n` 換行，會導致 shell script 或 Dockerfile 執行失敗。

```bash
sudo apt install dos2unix -y

# 批次轉換整個專案（排除 binary 檔）
find /opt/tn-welcomeboard -type f \
  \( -name "*.go" -o -name "*.ts" -o -name "*.tsx" \
     -o -name "*.js" -o -name "*.json" -o -name "*.sh" \
     -o -name "*.sql" -o -name "Dockerfile" -o -name "*.conf" \
     -o -name "*.yml" -o -name "*.yaml" -o -name "*.md" \) \
  -exec dos2unix {} \;
```

update
# 批次轉換所有文字檔（修正 CRLF 和 UTF-16 NUL 問題）
find . -type f \
  \( -name "*.go" -o -name "*.ts" -o -name "*.tsx" \
     -o -name "*.js" -o -name "*.json" -o -name "*.sh" \
     -o -name "*.sql" -o -name "Dockerfile" -o -name ".dockerignore" \
     -o -name "*.conf" -o -name "*.yml" -o -name "*.yaml" \) \
  -exec dos2unix {} \;

---

## 3. 建立 media 目錄並設定權限

```bash
cd /opt/tn-welcomeboard

mkdir -p media

# Docker 容器內以 nobody/root 寫入，給予 777 最省事
# 若有資安顧慮，可改為 775 並將你的 user 加入 docker group
chmod 777 media
```

---

## 4. 確認 Docker Compose 版本

```bash
docker compose version
# 需要 v2.x 以上（指令為 "docker compose"，非舊版 "docker-compose"）
```

若仍是舊版 `docker-compose`（v1），請升級或將下方指令中的 `docker compose` 改為 `docker-compose`。

---

## 5. 啟動服務

```bash
cd /opt/tn-welcomeboard

# 首次啟動（含 build）
docker compose up --build -d

# 查看狀態
docker compose ps

# 查看 log
docker compose logs -f
```

| 服務 | URL |
|---|---|
| Admin Portal | http://\<server-ip\>:3000 |
| Display / Preview | http://\<server-ip\>:8080/ |
| Backend API Health | http://\<server-ip\>:8080/api/v1/health |

---

## 6. 防火牆設定（UFW）

Ubuntu 預設啟用 UFW。需開放以下 port：

```bash
sudo ufw allow 3000/tcp   # Admin Portal
sudo ufw allow 8080/tcp   # Backend + Display

# 若只允許特定 IP 存取（更安全）
# sudo ufw allow from 192.168.1.0/24 to any port 3000
# sudo ufw allow from 192.168.1.0/24 to any port 8080

sudo ufw reload
sudo ufw status
```

---

## 7. 設定開機自動啟動（systemd）

讓服務在伺服器重開機後自動恢復。

```bash
sudo nano /etc/systemd/system/tn-welcomeboard.service
```

貼入以下內容（調整 `WorkingDirectory` 與 `User`）：

```ini
[Unit]
Description=TN Welcome Board Digital Signage
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/tn-welcomeboard
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=root
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tn-welcomeboard
sudo systemctl start tn-welcomeboard

# 確認狀態
sudo systemctl status tn-welcomeboard
```

---

## 8. 資料庫持久化確認

PostgreSQL 資料儲存在 Docker named volume `postgres_data`，**重啟容器不會遺失資料**。

```bash
# 查看 volume
docker volume ls | grep postgres_data

# 備份資料庫（建議定期執行）
docker exec tn-welcomeboard-postgres-1 \
  pg_dump -U signage signage > backup_$(date +%Y%m%d).sql

# 還原
cat backup_20260424.sql | docker exec -i tn-welcomeboard-postgres-1 \
  psql -U signage signage
```

---

## 9. Electron Converter 在 Linux 的處理方式

> **重要：Electron Converter 是 Windows GUI 工具，不在 Docker 中運行。**

### 選項 A：繼續在 Windows 上使用（推薦）
- 在 Windows 上執行 Converter 產出 `.html` 檔
- 透過 Admin Portal（http://\<server-ip\>:3000）上傳到 Linux 伺服器
- 上傳的媒體檔存放在 `/opt/tn-welcomeboard/media/`

### 選項 B：在 Linux 桌面版上執行（若有圖形介面）
```bash
# 安裝 LibreOffice（必要相依）
sudo apt install libreoffice -y

# 安裝 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# 執行 Converter（需要桌面環境 X11/Wayland）
cd /opt/tn-welcomeboard/electron-converter
npm install
npm start
```

### 選項 C：Linux 無頭（headless）轉換替代方案
若無桌面環境，可直接用 LibreOffice CLI 轉換，再手動處理資源嵌入：
```bash
# 安裝 LibreOffice
sudo apt install libreoffice -y

# PPTX → HTML（輸出在 /tmp/output/）
soffice --headless --convert-to html \
  --outdir /tmp/output/ your_presentation.pptx
```
產出的 HTML 需手動或自行寫 script 處理圖片 base64 嵌入。

---

## 10. 時區設定

`docker-compose.yml` 已設定 `TZ: Asia/Taipei`，容器時區正確。  
若需同步 Ubuntu host 時區：

```bash
sudo timedatectl set-timezone Asia/Taipei
timedatectl status
```

---

## 11. 常用維運指令

```bash
# 重啟所有服務
docker compose restart

# 只重啟 backend
docker compose restart backend

# 更新程式碼後重新 build
git pull
docker compose up --build -d

# 查看各容器資源使用
docker stats

# 進入 backend 容器除錯
docker compose exec backend sh

# 進入資料庫
docker compose exec postgres psql -U signage signage

# 停止並清除所有容器（資料庫 volume 保留）
docker compose down

# 完全清除含資料庫（危險！）
docker compose down -v
```

---

## 12. 注意事項總覽

| 項目 | 說明 |
|---|---|
| 換行符號 | Windows 編輯的檔案必須執行 `dos2unix` |
| media 目錄 | 需手動建立並設定寫入權限 |
| 防火牆 | 需開放 3000 與 8080 port |
| Electron Converter | 不在 Docker 中；Linux server 版無法直接執行 GUI |
| 資料庫備份 | 建議用 cron 定期 `pg_dump` |
| Docker Compose | 需使用 v2（`docker compose`，非 `docker-compose`） |
| 開機自啟 | 透過 systemd service 設定 |
| 時區 | `TZ: Asia/Taipei` 已在 compose 設定，host 另需 `timedatectl` |
| Display 頁面 | 需保持瀏覽器開啟才能收到 WebSocket push |
