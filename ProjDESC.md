# CLAUDE.md — TN Welcome Board Digital Signage

## Project Overview

A self-hosted digital signage (Welcome Board) system with three components:
- **Backend**: Go 1.22+ REST API + WebSocket server (Docker)
- **Frontend**: React 18 admin portal (Docker, served by nginx)
- **Electron Converter**: Windows desktop tool for PPTX → HTML5 conversion (local, not containerized)

## Running the System

```bash
# Start the full web stack
docker compose up --build -d

# Electron converter (runs locally, not in Docker)
cd electron-converter && npm install && npm start
```

| Service | URL |
|---|---|
| Admin Portal | http://localhost:3000 |
| Display Screen / Preview | http://localhost:8080/ |
| Backend API | http://localhost:8080/api/v1/health |
| Database | PostgreSQL 15 on port 5432 |

## Architecture

```
backend/
├── cmd/server/main.go
├── internal/
│   ├── handler/       # HTTP handlers
│   ├── service/       # Business logic
│   ├── repository/    # DB access (sqlx + raw SQL, no GORM)
│   └── model/         # Data structs
├── migrations/        # golang-migrate SQL files
└── Dockerfile

frontend/
├── src/
│   ├── pages/         # Dashboard, Playlists, Upload, Schedules
│   ├── components/
│   ├── store/useStore.ts   # Zustand
│   └── api/client.ts       # axios instance
└── Dockerfile

electron-converter/    # Not in Docker; requires LibreOffice on host
media/                 # Persistent upload storage → /app/media in container
```

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Go 1.22+, Gin, gorilla/websocket, gocron/v2, sqlx, golang-migrate |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, axios |
| Database | PostgreSQL 15 |
| Electron | Electron 28+, TypeScript, LibreOffice headless CLI |

## API Reference

All endpoints prefixed `/api/v1`. Errors: `{"error": "message"}`.

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/health | Health check |
| GET | /api/v1/devices | List devices (always returns the single Preview Device) |
| POST | /api/v1/devices | Create device (max 1 enforced) |
| GET | /api/v1/playlists | List playlists |
| POST | /api/v1/playlists | Create playlist |
| GET | /api/v1/playlists/:id | Get playlist with items |
| PUT | /api/v1/playlists/:id | Update playlist |
| DELETE | /api/v1/playlists/:id | Delete playlist |
| POST | /api/v1/playlists/:id/items | Add item to playlist |
| DELETE | /api/v1/playlists/:id/items/:itemId | Remove item |
| POST | /api/v1/upload | Upload media file |
| GET | /api/v1/schedules | List schedules |
| POST | /api/v1/schedules | Create schedule |
| DELETE | /api/v1/schedules/:id | Delete schedule |
| POST | /api/v1/devices/:deviceId/push | Push playlist to device |
| GET | /ws | WebSocket endpoint |
| GET | / | Redirect → Preview Device display |
| GET | /display/:deviceId | Display page (Go template HTML) |

## Key System Behaviors

- **Single Preview Device**: MVP is locked to one device (ID: `00000000-0000-0000-0000-000000000001`). Backend rejects creating a second device.
- **Root redirect**: `GET /` serves the preview display HTML directly.
- **Default state**: Display shows full-screen CSS SMPTE color bars when no playlist has been pushed.
- **Push-only architecture**: Display must already be open when a push occurs — it will not receive missed pushes retroactively.
- **WebSocket reconnect**: Exponential backoff (1s → 2s → 4s → 8s → max 30s).
- **Ping/Pong**: Hub pings every 30s; 60s without pong → disconnect.

## Display Modes

All modes: black background, `overflow: hidden`, immediate switch on `SWITCH_PLAYLIST` message.

| Mode | Behavior |
|---|---|
| `html5_slides` | Full-screen `<iframe>` per slide, CSS fade transition (300ms), auto-advance by `transition_seconds` |
| `image_loop` | Full-screen `<img>` with `object-fit: contain`, CSS crossfade, auto-advance |
| `video_loop` | Full-screen `<video autoplay muted loop>`, advances via `ended` event for multi-video playlists |

## WebSocket Message Format

```go
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

Devices connect via `?device_id=xxx` query parameter.

## Database Schema

Migrations live in `backend/migrations/` (golang-migrate).

- `devices` — UUID PK, name, description, last_seen_at
- `playlists` — UUID PK, name, mode (`html5_slides|image_loop|video_loop`), transition_seconds (default 5)
- `playlist_items` — UUID PK, playlist_id (CASCADE), content_type (`html5|image|video`), file_path, sort_order, duration_seconds
- `schedules` — UUID PK, device_id, playlist_id, start_time, end_time, days_of_week (int[]), is_active

## Backend Conventions

- Raw SQL via `sqlx` — **no GORM**
- Always return `[]` (empty array), never `null`, for list endpoints
- Media files served from `media/` via Gin `Static()`
- Display pages rendered by Go template (not the React app)
- CORS must allow `http://localhost:3000` in development

## Frontend Conventions

- Vite proxy in dev: `/api`, `/ws`, `/media`, `/display` → `http://localhost:8080`
- Toast notifications (bottom of screen), not `alert()`
- Upload page supports drag-and-drop + progress bar via axios `onUploadProgress`
- Guard all `.map()` calls — API may return empty arrays; `useStore.ts` must initialize with `[]`
- Default transition/duration: **5 seconds**

## File Upload

- Accepted: `.html`, `.jpg`, `.png`, `.gif`, `.mp4`, `.webm`
- Size limits: 500MB (video), 50MB (other)
- Storage: `./media/{filename}` → `/app/media/{filename}` in container
- Response: `{"name": "filename", "url": "/media/filename", "type": "media"}`

## Schedule Engine

- gocron runs every minute, scanning the `schedules` table
- Matches current time against `days_of_week`, `start_time`, `end_time`
- Sends `SWITCH_PLAYLIST` via WebSocket Hub if active playlist differs

## Electron Converter

- Converts PPTX → single self-contained HTML5 via `soffice --headless --convert-to html`
- Post-processes output: base64-encodes all local `<img src>` and `<link href>` resources
- Result: one `.html` file (~2–10 MB) uploadable to the admin portal
- Requires LibreOffice installed on the host machine (`soffice` in PATH)

## Cross-Platform Notes

- System storage queries must branch on OS (Windows vs Linux) to avoid compile errors
- Electron app targets Windows x64 (electron-builder)
