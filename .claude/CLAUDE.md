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
| Display Screen Device:000 | http://localhost:8080/ |
| Display Screen Device:001–015 | http://localhost:8081/ … http://localhost:8095/ |
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

---

## Enhancement & Optimization Focus

This project is in active enhancement mode. Prioritize these areas in order:

### 1. Display Reliability
- WebSocket reconnect must be bulletproof — test disconnect/reconnect scenarios
- `SWITCH_PLAYLIST` must apply atomically; no partial render states
- `html5_slides` iframe transitions must not flicker or leave ghost frames

### 2. Upload & Media Pipeline
- Validate file type server-side (magic bytes, not just extension)
- Large video uploads (>100MB) should stream rather than buffer in memory
- Electron converter output must be idempotent: same PPTX → same HTML structure

### 3. Scheduler Accuracy
- gocron fires every minute; ensure schedule matching handles timezone edge cases
- Avoid pushing the same playlist twice in a row (check current active playlist before push)
- Log schedule trigger events for debugging

### 4. Frontend UX
- All async actions must show loading state and surface errors via toast
- Playlist item reordering (drag-and-drop sort_order update) is a known gap to address
- Preview the display from the admin portal without opening a separate tab

### 5. Developer Experience
- `docker compose up --build -d` must succeed from a clean checkout
- Migration failures must be surfaced clearly, not silently skipped

---

## Code Rules (apply to all changes)

### General
- No new dependencies without strong justification — the stack is intentionally minimal
- No GORM; stay with raw SQL via `sqlx`
- No `alert()` in frontend; use toast notifications
- No `null` returns on list endpoints — always return `[]`
- Don't add comments that describe what code does; only add them when the WHY is non-obvious

### Backend (Go)
- Handler → Service → Repository layering must be respected; no DB calls in handlers
- All SQL queries belong in `repository/`; business logic belongs in `service/`
- New migrations: add a file in `backend/migrations/`, never ALTER the existing files
- Errors propagate up; don't swallow them silently
- Any OS-specific code (disk stats, paths) must branch on `runtime.GOOS`

### Frontend (React / TypeScript)
- Guard every `.map()` call — API may return empty arrays
- `useStore.ts` initializes all collections with `[]`
- New pages go in `src/pages/`; shared UI in `src/components/`
- Vite proxy handles `/api`, `/ws`, `/media`, `/display` in dev — do not hardcode `localhost:8080`
- No inline styles; use Tailwind classes

### WebSocket
- Only send `SWITCH_PLAYLIST` from the backend Hub — never from the display page
- Display page only reads and reacts to messages; it never initiates playlist changes

---

## API Reference

All endpoints prefixed `/api/v1`. Errors: `{"error": "message"}`.

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/health | Health check |
| GET | /api/v1/devices | List all devices |
| POST | /api/v1/devices | Create device (no limit enforced) |
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
| GET | /api/v1/ports | List display port mappings |
| POST | /api/v1/ports | Add display port (8081–8095); auto-creates device |
| PATCH | /api/v1/ports/:port | Update port label |
| DELETE | /api/v1/ports/:port | Remove display port (not 8080) |
| GET | /ws | WebSocket endpoint |
| GET | / | Redirect → Preview Device display |
| GET | /display/:deviceId | Display page (Go template HTML) |

## Key System Behaviors

- **Multi-Screen Support**: Up to 16 display ports (8080–8095). Port 8080 is the default (`Device:000`) and cannot be removed. Each port maps to a device UUID and runs its own HTTP listener goroutine. Device naming convention: `Device:000` → port 8080, `Device:001` → port 8081, …, `Device:015` → port 8095.
- **PortManager**: Lives in `service/portmanager.go`. Starts/stops lightweight `http.Server` instances per port. All sub-listeners share the same WebSocket Hub and DB pool.
- **Root redirect**: `GET /` on port 8080 serves the preview display HTML directly.
- **Default state**: Display shows full-screen CSS SMPTE color bars when no playlist has been pushed.
- **Push-only architecture**: Display must already be open when a push occurs — it will not receive missed pushes retroactively.
- **WebSocket reconnect**: Exponential backoff (1s → 2s → 4s → 8s → max 30s).
- **Ping/Pong**: Hub pings every 30s; 60s without pong → disconnect.
- **Sub-listener stability**: Each port listener runs in its own goroutine with `recover()`. A crash on one port does not affect other ports or port 8080.

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
- `display_ports` — port_number INTEGER PK (8080–8095), device_id FK, label (default `Display{PORT}`); port 8080 seeded on startup with label `Display8080`

## File Upload

- Accepted: `.html`, `.jpg`, `.png`, `.gif`, `.mp4`, `.webm`
- Size limits: 500MB (video), 50MB (other)
- Storage: `./media/{filename}` → `/app/media/{filename}` in container
- Response: `{"name": "filename", "url": "/media/filename", "type": "media"}`

## Displays Page (Admin UI)

`localhost:3000/displays` — fixed 16-row table, one row per port (8080–8095).

| Column | Active port | Inactive port |
|---|---|---|
| Status dot | 🟢 Online / 🔴 Offline | ⚪ Not configured |
| Device | `Device:000 – localhost:8080` (clickable link) | `Device:001 – localhost:8081` (grey) |
| Label | Editable input; auto-saved 800 ms after typing stops | Placeholder `Display808X`; Enter → Add |
| Action | **Remove** (disabled for port 8080) | **Add** |

**Add behaviour**: clicking Add auto-creates a device named after the label (falls back to `Display{PORT}`), then creates the port record and starts the sub-listener. No manual device or port selection required.

**Label editing**: changes are debounced (800 ms) and PATCH-saved automatically. A ✓ indicator appears briefly on success. Leaving the field blank saves the default label `Display{PORT}`.

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
