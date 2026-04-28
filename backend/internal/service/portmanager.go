package service

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"runtime/debug"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"welcome-board-backend/internal/hub"
)

type PortManager struct {
	mu       sync.Mutex
	servers  map[int]*http.Server
	wsHub    *hub.Hub
	mediaDir string
	htmlGen  func(deviceID string) string
}

func NewPortManager(h *hub.Hub, mediaDir string, htmlGen func(string) string) *PortManager {
	return &PortManager{
		servers:  make(map[int]*http.Server),
		wsHub:    h,
		mediaDir: mediaDir,
		htmlGen:  htmlGen,
	}
}

func (pm *PortManager) Start(portNumber int, deviceID string) error {
	if portNumber == 8080 {
		return fmt.Errorf("port 8080 is managed by the main server")
	}

	// Bind the port before acquiring the mutex so the syscall never holds the lock.
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", portNumber))
	if err != nil {
		return fmt.Errorf("cannot bind port %d: %w", portNumber, err)
	}

	htmlContent := pm.htmlGen(deviceID)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, htmlContent)
	})

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	wsHub := pm.wsHub
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		dID := r.URL.Query().Get("device_id")
		if dID == "" {
			http.Error(w, `{"error":"device_id required"}`, http.StatusBadRequest)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("PortManager WS upgrade error on :%d: %v", portNumber, err)
			return
		}
		client := &hub.Client{
			Hub:      wsHub,
			Conn:     conn,
			DeviceID: dID,
			Send:     make(chan []byte, 256),
		}
		wsHub.Register <- client
		go client.WritePump()
		go client.ReadPump()
	})

	mux.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir(pm.mediaDir))))

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", portNumber),
		Handler:      mux,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Register under the mutex, then release before launching the goroutine
	// so the goroutine's cleanup defer can acquire the mutex freely.
	pm.mu.Lock()
	if _, exists := pm.servers[portNumber]; exists {
		pm.mu.Unlock()
		ln.Close()
		return fmt.Errorf("port %d is already running", portNumber)
	}
	pm.servers[portNumber] = srv
	pm.mu.Unlock()

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("PortManager: listener on :%d panicked: %v\n%s", portNumber, r, debug.Stack())
			}
			pm.mu.Lock()
			delete(pm.servers, portNumber)
			pm.mu.Unlock()
		}()
		log.Printf("PortManager: display listener started on :%d for device %s", portNumber, deviceID)
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Printf("PortManager: listener on :%d error: %v", portNumber, err)
		}
	}()

	return nil
}

func (pm *PortManager) Stop(portNumber int) {
	pm.mu.Lock()
	srv, exists := pm.servers[portNumber]
	if exists {
		delete(pm.servers, portNumber)
	}
	pm.mu.Unlock()

	if !exists {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("PortManager: shutdown error on :%d: %v", portNumber, err)
	}
	log.Printf("PortManager: listener on :%d stopped", portNumber)
}

func (pm *PortManager) StopAll() {
	pm.mu.Lock()
	ports := make([]int, 0, len(pm.servers))
	for p := range pm.servers {
		ports = append(ports, p)
	}
	pm.mu.Unlock()

	for _, p := range ports {
		pm.Stop(p)
	}
}
