# Welcome Board MVP - Agent Instructions

This repository contains a Digital Signage system consisting of three main components: a Go backend, a React frontend, and an Electron conversion tool.

## Architecture & Boundaries
- `backend/`: Go 1.22+ API and WebSocket server. Uses Gin, `gorilla/websocket`, `go-co-op/gocron`, and `sqlx` (raw SQL, **no GORM**). 
- `frontend/`: React 18 + Vite + TypeScript. Uses Tailwind CSS, and Zustand. Proxies `/api`, `/ws`, `/media`, and `/display` to the backend.
- `electron-converter/`: Electron 28+ app. Converts PPTX to self-contained HTML5 using **LibreOffice headless CLI**. Requires LibreOffice installed on the host machine.
- `media/`: Persistent storage for uploaded media. Mapped to `/app/media` in the backend container.

## Local Development & Execution
The web stack is containerized. Use Docker Compose to run it:
```bash
docker compose up --build -d
```
- Frontend Admin Portal: `http://localhost:3000`
- Display Screen (Preview): `http://localhost:8080` (Directly opens the Local Preview Screen)
- Backend API: `http://localhost:8080/api/v1/health`
- Database: Postgres 15

The Electron app runs locally on the host, not in Docker:
```bash
cd electron-converter
npm install
npm start
```

## System Optimizations & Specific Behaviors
- **Single Preview Device**: The MVP is currently locked to a single "Local Preview Screen" (ID: `00000000-0000-0000-0000-000000000001`). The backend prevents the creation of additional devices.
- **Root URL Redirect**: Accessing `http://localhost:8080/` automatically serves the preview display HTML.
- **Default Color Bar**: When the display screen connects but has no playlist pushed to it, it renders a full-screen CSS SMPTE color bar pattern as a default empty state.
- **Push Mechanism**: The system relies on WebSocket push messages (`SWITCH_PLAYLIST`). **The display screen must be open and connected before you push a playlist from the dashboard.** If a push occurs while the screen is closed, the screen will not see the content when opened (until pushed again).
- **Exponential Backoff**: The display screen attempts to reconnect using an exponential backoff strategy (1s, 2s, 4s, 8s, max 30s) if the WebSocket connection drops.
- **Frontend Enhancements**: The admin portal uses non-blocking toast notifications instead of alerts, and supports drag-and-drop file uploads.

## Backend Quirks & Conventions
- **Migrations**: Database schema changes use `golang-migrate/migrate`. Migration files are in `backend/migrations/`.
- **Media Serving**: Files in `media/` are served directly via Gin's static file server.
- **Display Rendering**: `GET /display/:deviceId` serves a template-rendered HTML document containing the logic for WebSocket reconnection, DOM rotation, and rendering based on the pushed mode (`html5_slides`, `image_loop`, `video_loop`).

## Frontend Conventions
- Uses Vite proxy to bypass CORS in development.
- No separate router for display rendering - display pages are served entirely by the backend.

## Electron Converter Quirk
- Relies heavily on `soffice` (LibreOffice) to parse and generate HTML. It post-processes the output to base64-encode resources (images, css) resulting in a single, self-contained HTML file uploaded directly to the backend.
