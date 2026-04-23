package hub

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

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

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	DeviceID string
	Send     chan []byte
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second // Must be less than pongWait
	maxMessageSize = 512
)

func (c *Client) ReadPump() {
	defer func() {
		log.Printf("ReadPump exiting for device %s", c.DeviceID)
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			} else {
				log.Printf("Read error for %s: %v", c.DeviceID, err)
			}
			break
		}
		
		// Optional: handle client messages
		var msg Message
		if err := json.Unmarshal(message, &msg); err == nil {
			if msg.Type == MsgPong {
				c.Conn.SetReadDeadline(time.Now().Add(pongWait))
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		log.Printf("WritePump exiting for device %s", c.DeviceID)
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				log.Printf("Write error NextWriter for %s: %v", c.DeviceID, err)
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				log.Printf("Write error Close for %s: %v", c.DeviceID, err)
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping write error for %s: %v", c.DeviceID, err)
				return
			}
		}
	}
}

type Hub struct {
	clients    map[string]map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if h.clients[client.DeviceID] == nil {
				h.clients[client.DeviceID] = make(map[*Client]bool)
			}
			h.clients[client.DeviceID][client] = true
			h.mu.Unlock()
			log.Printf("Device %s connected", client.DeviceID)
		case client := <-h.Unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.DeviceID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.clients, client.DeviceID)
					}
				}
			}
			close(client.Send)
			h.mu.Unlock()
			log.Printf("Device %s disconnected", client.DeviceID)
		}
	}
}

func (h *Hub) BroadcastToDevice(deviceID string, msg Message) {
	h.mu.RLock()
	clients, ok := h.clients[deviceID]
	if !ok || len(clients) == 0 {
		h.mu.RUnlock()
		return
	}
	
	// Create a copy of clients to send to, to avoid holding the lock
	clientsCopy := make([]*Client, 0, len(clients))
	for client := range clients {
		clientsCopy = append(clientsCopy, client)
	}
	h.mu.RUnlock()

	msg.Timestamp = time.Now()
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	for _, client := range clientsCopy {
		select {
		case client.Send <- data:
		default:
			// Non-blocking: run unregister in its own goroutine so broadcast
			// never stalls waiting for hub.Run() to consume the channel.
			go func(c *Client) { h.Unregister <- c }(client)
		}
	}
}

func (h *Hub) BroadcastToAll(msg Message) {
	msg.Timestamp = time.Now()
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	h.mu.RLock()
	clientsCopy := make([]*Client, 0)
	for _, clients := range h.clients {
		for client := range clients {
			clientsCopy = append(clientsCopy, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range clientsCopy {
		select {
		case client.Send <- data:
		default:
			go func(c *Client) { h.Unregister <- c }(client)
		}
	}
}

func (h *Hub) IsDeviceConnected(deviceID string) bool {
	h.mu.RLock()
	clients, ok := h.clients[deviceID]
	h.mu.RUnlock()
	return ok && len(clients) > 0
}