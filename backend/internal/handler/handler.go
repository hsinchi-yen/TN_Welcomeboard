package handler

import (
	"encoding/base64"
	"encoding/json"
	_ "embed"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"welcome-board-backend/internal/hub"
	"welcome-board-backend/internal/model"
	"welcome-board-backend/internal/service"
)

//go:embed assets/technexion_logo-white.svg
var logoWhiteSVG []byte

var logoWhiteDataURI = "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString(logoWhiteSVG)

type Handler struct {
	svc      *service.Service
	hub      *hub.Hub
	mediaDir string
	pm       *service.PortManager
}

func NewHandler(svc *service.Service, h *hub.Hub, mediaDir string) *Handler {
	return &Handler{svc: svc, hub: h, mediaDir: mediaDir}
}

func (h *Handler) SetPortManager(pm *service.PortManager) {
	h.pm = pm
}

// ? ? ?  Health ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) HealthCheck(c *gin.Context) {
	dbStatus := "connected"
	if err := h.svc.Repo().GetDB().Ping(); err != nil {
		dbStatus = "disconnected"
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "db": dbStatus})
}

// ? ? ?  Devices ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) GetDevices(c *gin.Context) {
	devices, err := h.svc.Repo().GetDevices(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for i := range devices {
		devices[i].IsOnline = h.hub.IsDeviceConnected(devices[i].ID)
	}
	c.JSON(http.StatusOK, devices)
}

func (h *Handler) CreateDevice(c *gin.Context) {
	var d model.Device
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Repo().CreateDevice(c.Request.Context(), &d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

// ? ? ?  Playlists ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) GetPlaylists(c *gin.Context) {
	playlists, err := h.svc.Repo().GetPlaylists(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, playlists)
}

func (h *Handler) CreatePlaylist(c *gin.Context) {
	var p model.Playlist
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if p.TransitionSeconds <= 0 {
		p.TransitionSeconds = 5
	}
	if err := h.svc.Repo().CreatePlaylist(c.Request.Context(), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *Handler) GetPlaylist(c *gin.Context) {
	p, err := h.svc.Repo().GetPlaylist(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "playlist not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) UpdatePlaylist(c *gin.Context) {
	var p model.Playlist
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Repo().UpdatePlaylist(c.Request.Context(), c.Param("id"), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *Handler) DeletePlaylist(c *gin.Context) {
	if err := h.svc.Repo().DeletePlaylist(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ? ? ?  Playlist Items ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) AddPlaylistItem(c *gin.Context) {
	var item model.PlaylistItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.PlaylistID = c.Param("id")
	if item.DurationSeconds == nil {
		defaultDur := 5
		item.DurationSeconds = &defaultDur
	}
	if item.ContentType == "" {
		item.ContentType, _ = detectMediaType(filepath.Base(item.FilePath))
	}
	if err := h.svc.Repo().AddPlaylistItem(c.Request.Context(), &item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdatePlaylistItem(c *gin.Context) {
	var body struct {
		DurationSeconds *int `json:"duration_seconds"`
		SortOrder       int  `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	duration := 5
	if body.DurationSeconds != nil {
		duration = *body.DurationSeconds
	}
	if err := h.svc.Repo().UpdatePlaylistItem(c.Request.Context(), c.Param("itemId"), duration, body.SortOrder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *Handler) DeletePlaylistItem(c *gin.Context) {
	if err := h.svc.Repo().DeletePlaylistItem(c.Request.Context(), c.Param("itemId")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ? ? ?  Upload ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

var allowedExts = map[string]bool{
	".html": true, ".htm": true,
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
	".svg": true, ".webp": true, ".bmp": true, ".ico": true, ".avif": true,
	".mp4": true, ".webm": true,
}

func (h *Handler) UploadMedia(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file provided"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type: " + ext})
		return
	}

	maxSize := int64(1024 * 1024 * 1024) // 1 GB for all types
	if file.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 1 GB)"})
		return
	}

	safeName := safeFilename(file.Filename)
	destPath := filepath.Join(h.mediaDir, safeName)

	if err := c.SaveUploadedFile(file, destPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"name":          safeName,
		"original_name": file.Filename,
		"url":           "/media/" + safeName,
		"type":          "media",
	})
}

// ? ? ?  Media Library ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

type MediaItem struct {
	Name          string    `json:"name"`
	URL           string    `json:"url"`
	ContentType   string    `json:"content_type"`
	SuggestedMode string    `json:"suggested_mode"`
	Size          int64     `json:"size"`
	ModTime       time.Time `json:"mod_time"`
}

func (h *Handler) GetMediaLibrary(c *gin.Context) {
	entries, err := os.ReadDir(h.mediaDir)
	if err != nil {
		c.JSON(http.StatusOK, []MediaItem{})
		return
	}

	items := []MediaItem{}
	for _, e := range entries {
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, _ := e.Info()
		ct, mode := detectMediaType(e.Name())
		items = append(items, MediaItem{
			Name:          e.Name(),
			URL:           "/media/" + e.Name(),
			ContentType:   ct,
			SuggestedMode: mode,
			Size:          info.Size(),
			ModTime:       info.ModTime(),
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	c.JSON(http.StatusOK, items)
}

func (h *Handler) DeleteMedia(c *gin.Context) {
	filename := c.Param("filename")
	if strings.Contains(filename, "..") || strings.ContainsAny(filename, "/\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filename"})
		return
	}
	if err := os.Remove(filepath.Join(h.mediaDir, filename)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ? ? ?  Schedules ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) GetSchedules(c *gin.Context) {
	schedules, err := h.svc.Repo().GetSchedules(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedules)
}

func (h *Handler) CreateSchedule(c *gin.Context) {
	var s model.Schedule
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s.IsActive = true
	if err := h.svc.Repo().CreateSchedule(c.Request.Context(), &s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	if err := h.svc.Repo().DeleteSchedule(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ? ? ?  Push ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) PushToDevice(c *gin.Context) {
	deviceID := c.Param("deviceId")
	var body struct {
		PlaylistID string `json:"playlist_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.PlaylistID == "" || body.PlaylistID == "blank" {
		msg := hub.Message{
			Type:      hub.MsgSwitchPlaylist,
			DeviceID:  deviceID,
			Payload:   json.RawMessage(`null`),
			Timestamp: time.Now(),
		}
		h.hub.BroadcastToDevice(deviceID, msg)
		c.JSON(http.StatusOK, gin.H{"status": "pushed blank"})
		return
	}

	playlist, err := h.svc.Repo().GetPlaylist(c.Request.Context(), body.PlaylistID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "playlist not found"})
		return
	}

	type payload struct {
		PlaylistID        string              `json:"playlist_id"`
		Mode              string              `json:"mode"`
		Items             []model.PlaylistItem `json:"items"`
		TransitionSeconds int                 `json:"transition_seconds"`
	}
	p := payload{
		PlaylistID:        playlist.ID,
		Mode:              playlist.Mode,
		Items:             playlist.Items,
		TransitionSeconds: playlist.TransitionSeconds,
	}
	if p.Items == nil {
		p.Items = []model.PlaylistItem{}
	}

	payloadBytes, _ := json.Marshal(p)
	msg := hub.Message{
		Type:      hub.MsgSwitchPlaylist,
		DeviceID:  deviceID,
		Payload:   json.RawMessage(payloadBytes),
		Timestamp: time.Now(),
	}
	h.hub.BroadcastToDevice(deviceID, msg)
	c.JSON(http.StatusOK, gin.H{"status": "pushed", "playlist_id": playlist.ID})
}

// ? ? ?  WebSocket ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) ServeWs(c *gin.Context) {
	deviceID := c.Query("device_id")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id required"})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &hub.Client{
		Hub:      h.hub,
		Conn:     conn,
		DeviceID: deviceID,
		Send:     make(chan []byte, 256),
	}
	h.hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

// ? ? ?  System Storage ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) GetSystemStorage(c *gin.Context) {
	info, err := getDiskUsage(h.mediaDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total_bytes": info.TotalBytes,
		"used_bytes":  info.UsedBytes,
		"free_bytes":  info.FreeBytes,
	})
}

// ? ? ?  Display Pages ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func (h *Handler) ServeRootDisplay(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(BuildDisplayHTML(service.PreviewDeviceID)))
}

func (h *Handler) ServeDisplay(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		deviceID = service.PreviewDeviceID
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(BuildDisplayHTML(deviceID)))
}

// ? ? ?  Display Ports ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ?

func (h *Handler) GetDisplayPorts(c *gin.Context) {
	ports, err := h.svc.Repo().GetDisplayPorts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for i := range ports {
		ports[i].IsOnline = h.hub.IsDeviceConnected(ports[i].DeviceID)
	}
	c.JSON(http.StatusOK, ports)
}

func (h *Handler) CreateDisplayPort(c *gin.Context) {
	var dp model.DisplayPort
	if err := c.ShouldBindJSON(&dp); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if dp.PortNumber == 8080 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "port 8080 is the default and cannot be re-created"})
		return
	}
	if dp.PortNumber < 8081 || dp.PortNumber > 8095 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "port must be between 8081 and 8095"})
		return
	}
	if err := h.svc.Repo().CreateDisplayPort(c.Request.Context(), &dp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.pm != nil {
		if err := h.pm.Start(dp.PortNumber, dp.DeviceID); err != nil {
			if delErr := h.svc.Repo().DeleteDisplayPort(c.Request.Context(), dp.PortNumber); delErr != nil {
				// Compensating delete failed — log so the orphaned row is visible in logs.
				fmt.Printf("WARN: CreateDisplayPort rollback failed for port %d: %v\n", dp.PortNumber, delErr)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start listener: " + err.Error()})
			return
		}
	}
	dp.IsOnline = false
	c.JSON(http.StatusCreated, dp)
}

func (h *Handler) DeleteDisplayPort(c *gin.Context) {
	var portNumber int
	if _, err := fmt.Sscanf(c.Param("port"), "%d", &portNumber); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid port number"})
		return
	}
	if portNumber == 8080 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "default port cannot be removed"})
		return
	}
	// Stop the listener before removing the DB record so that on any restart
	// the port is not re-registered from a partially-deleted state.
	if h.pm != nil {
		h.pm.Stop(portNumber)
	}
	if err := h.svc.Repo().DeleteDisplayPort(c.Request.Context(), portNumber); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *Handler) UpdateDisplayPort(c *gin.Context) {
	var portNumber int
	if _, err := fmt.Sscanf(c.Param("port"), "%d", &portNumber); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid port number"})
		return
	}
	if portNumber < 8080 || portNumber > 8095 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "port must be between 8080 and 8095"})
		return
	}
	var body struct {
		Label string `json:"label"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	label := strings.TrimSpace(body.Label)
	if label == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "label cannot be empty"})
		return
	}
	if len(label) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "label must be 100 characters or fewer"})
		return
	}
	if err := h.svc.Repo().UpdateDisplayPortLabel(c.Request.Context(), portNumber, label); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// ? ? ?  Helpers ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ?

func safeFilename(original string) string {
	ext := filepath.Ext(original)
	stem := strings.TrimSuffix(original, ext)

	var b strings.Builder
	for _, r := range stem {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' || r == '.' {
			if r > 127 {
				b.WriteRune('_')
			} else {
				b.WriteRune(r)
			}
		} else if r == ' ' {
			b.WriteRune('_')
		}
	}
	safe := b.String()
	if safe == "" {
		safe = fmt.Sprintf("file_%d", time.Now().UnixMilli())
	}
	return safe + strings.ToLower(ext)
}

func detectMediaType(name string) (contentType string, suggestedMode string) {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".html", ".htm":
		return "html5", "html5_slides"
	case ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".ico", ".avif":
		return "image", "image_loop"
	case ".mp4", ".webm":
		return "video", "video_loop"
	default:
		return "image", "image_loop"
	}
}

// ? ? ?  Display HTML ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 

func BuildDisplayHTML(deviceID string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Display - %s</title>
  <style>
    :root { color-scheme: dark; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000; overflow: hidden; color: #fff; font-family: Arial, sans-serif; }

    /* Stage */
    #stage  { position: relative; width: 100vw; height: 100vh; background: #000; }
    #content{ width: 100%%; height: 100%%; position: relative; overflow: hidden; }

    /* Full-screen media elements */
    .fill        { width: 100%%; height: 100%%; border: 0; background: #000; display: block; }
    .image-frame { object-fit: contain; }
    .video-frame { object-fit: contain; }

    /* Cross-fade wrapper */
    .cf-slot {
      position: absolute; inset: 0;
      opacity: 0; transition: opacity 0.35s ease;
      pointer-events: none;
    }
    .cf-slot.active { opacity: 1; pointer-events: auto; }

    /* SMPTE colour bars (default / no-content state) */
    .color-bars { display: flex; width: 100%%; height: 100%%; position: relative; }
    .color-bars > div { flex: 1; }
    .cb-w { background: #EBEBEB; } .cb-y { background: #EBEB00; }
    .cb-c { background: #00EBEB; } .cb-g { background: #00EB00; }
    .cb-m { background: #EB00EB; } .cb-r { background: #EB0000; }
    .cb-b { background: #0000EB; }
    .cb-logo { position: absolute; top: 50%%; left: 50%%; transform: translate(-50%%, -50%%); z-index: 10; width: 300px; max-width: 80%%; }

    /* Status overlay (shown only during disconnection) */
    #status {
      position: absolute; inset: 0;
      display: none;
      flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; background: rgba(0,0,0,.55); z-index: 30;
      font-size: 14px; color: #d1d5db; text-align: center;
    }
    #status.visible { display: flex; }
  </style>
</head>
<body>
<div id="stage">
  <div id="status"><div id="status-text">Reconnecting...</div></div>
  <div id="content"></div>
</div>

<script>
(function () {
  'use strict';

  const DEVICE_ID   = %q;
  const STORAGE_KEY = 'wb:display:' + DEVICE_ID;

  const $status  = document.getElementById('status');
  const $statusT = document.getElementById('status-text');
  const $content = document.getElementById('content');

  /* ? ?  Helpers ? ?  */
  function showStatus(msg) {
    $statusT.textContent = msg;
    $status.classList.add('visible');
  }
  function hideStatus() { $status.classList.remove('visible'); }

    function normSrc(path) {
      if (!path) return '';
      if (/^https?:\/\//.test(path)) return path;
      if (path.startsWith('/')) return path;
      // Add absolute slash to ensure Nginx proxy routes correctly to backend
      return '/media/' + path.replace(/^\.\//, '');
    }

    /* ? ?  Cross-fade slot manager ? ?  */
    let slotA = null, slotB = null, activeSlot = 'a';

    function getSlots() {
      if (!slotA) {
        slotA = document.createElement('div');
        slotA.className = 'cf-slot active';
      }
      if (!slotB) {
        slotB = document.createElement('div');
        slotB.className = 'cf-slot';
      }
      if (slotA.parentNode !== $content || slotB.parentNode !== $content) {
        $content.innerHTML = '';
        $content.appendChild(slotA);
        $content.appendChild(slotB);
      }
      return { 
        active: activeSlot === 'a' ? slotA : slotB,
        inactive: activeSlot === 'a' ? slotB : slotA 
      };
    }

    function applyToInactiveAndSwap(element, animate) {
      try {
        const { active, inactive } = getSlots();
        inactive.innerHTML = '';
        if (element) {
          inactive.appendChild(element);
          if (element.tagName === 'VIDEO') {
            element.play().catch(e => console.warn('Video play failed:', e));
          }
        }
        inactive.classList.add('active');
        active.classList.remove('active');
        
        if (animate) {
          setTimeout(() => { active.innerHTML = ''; }, 380);
        } else {
          active.innerHTML = '';
        }
        activeSlot = activeSlot === 'a' ? 'b' : 'a';
      } catch (err) {
        console.error('DOM Swap error:', err);
        renderColorBars();
      }
    }

    /* ? ?  Rotation timer ? ?  */
    let rotTimer = null;
    function clearRot() { if (rotTimer) { clearTimeout(rotTimer); rotTimer = null; } }

    function schedNext(transMs) {
      clearRot();
      rotTimer = setTimeout(() => {
        if (!currentPayload || !currentPayload.items || currentPayload.items.length === 0) return;
        currentIndex = (currentIndex + 1) %% currentPayload.items.length;
        renderCurrent(true);
      }, transMs);
    }

    /* ? ?  Render ? ?  */
    let currentPayload = null;
    let currentIndex   = 0;

    function renderColorBars() {
      hideStatus();
      $content.innerHTML =
        '<div class="color-bars">' +
        '<div class="cb-w"></div><div class="cb-y"></div><div class="cb-c"></div>' +
        '<div class="cb-g"></div><div class="cb-m"></div><div class="cb-r"></div>' +
        '<div class="cb-b"></div>' +
        '<div class="cb-logo"><img src="%s" alt="TechNexion" style="width:100%%;height:100%%;object-fit:contain;"></div></div>';
      slotA = slotB = null;
    }


  function renderCurrent(animate) {
    clearRot();
    if (!currentPayload ||
        !Array.isArray(currentPayload.items) ||
        currentPayload.items.length === 0) {
      renderColorBars();
      return;
    }
    hideStatus();

    const item    = currentPayload.items[currentIndex];
    const src     = normSrc(item.file_path);
    const mode    = currentPayload.mode;
    const transSec = Math.max(
      Number(item.duration_seconds) ||
      Number(currentPayload.transition_seconds) || 5, 1);

    if (mode === 'html5_slides') {
      const frame = document.createElement('iframe');
      frame.className = 'fill';
      frame.allow = 'autoplay; fullscreen';
      frame.src = src;
      applyToInactiveAndSwap(frame, animate);
      if (currentPayload.items.length > 1) schedNext(transSec * 1000);
      return;
    }

    if (mode === 'video_loop') {
      const vid = document.createElement('video');
      vid.className = 'fill video-frame';
      vid.autoplay = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.controls = false;
      vid.setAttribute('muted', '');
      vid.setAttribute('autoplay', '');
      vid.setAttribute('playsinline', '');

      vid.onended = () => {
        if (currentPayload && currentPayload.items.length > 1) {
          currentIndex = (currentIndex + 1) %% currentPayload.items.length;
          renderCurrent(true);
        } else {
          vid.currentTime = 0;
          vid.play().catch(() => {});
        }
      };

      vid.onerror = () => {
        console.warn('Video failed to load:', src);
        clearCachedPayload();
        renderColorBars();
      };

      vid.src = src;
      applyToInactiveAndSwap(vid, animate);
      return;
    }

    // image_loop (default)
    const img = document.createElement('img');
    img.className = 'fill image-frame';
    img.alt = item.display_name || '';
    img.onerror = () => {
      console.warn('Image failed to load:', src);
      clearCachedPayload();
      renderColorBars();
    };
    img.src = src;
    applyToInactiveAndSwap(img, animate);
    if (currentPayload.items.length > 1) schedNext(transSec * 1000);
  }

  function clearCachedPayload() {
    currentPayload = null;
    currentIndex = 0;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function applyPayload(payload) {
    currentPayload = payload;
    currentIndex   = 0;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
    renderCurrent(false);
  }

  let ws = null;
  let retryDelay = 1000;

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws?device_id=' + DEVICE_ID);

    ws.onopen = () => {
      retryDelay = 1000;
      hideStatus();
      if (!currentPayload) renderCurrent(false);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'SWITCH_PLAYLIST') applyPayload(msg.payload);
      } catch (_) {}
    };

    ws.onclose = () => {
      showStatus('Disconnected - reconnecting in ' + (retryDelay / 1000).toFixed(0) + 's...');
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };

    ws.onerror = () => { ws.close(); };
  }

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) currentPayload = JSON.parse(cached);
  } catch (_) { localStorage.removeItem(STORAGE_KEY); }

  renderCurrent(false);
  connect();
})();
</script>
</body>
</html>`, deviceID, deviceID, logoWhiteDataURI)
}


