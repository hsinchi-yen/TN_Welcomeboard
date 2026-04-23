package model

import (
	"time"

	"github.com/lib/pq"
)

type Device struct {
	ID          string     `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	Description *string    `json:"description" db:"description"`
	LastSeenAt  *time.Time `json:"last_seen_at" db:"last_seen_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	IsOnline    bool       `json:"is_online"` // computed field for API
}

type Playlist struct {
	ID                string         `json:"id" db:"id"`
	Name              string         `json:"name" db:"name"`
	Mode              string         `json:"mode" db:"mode"`
	TransitionSeconds int            `json:"transition_seconds" db:"transition_seconds"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at" db:"updated_at"`
	ItemCount         int            `json:"item_count" db:"item_count"`
	Items             []PlaylistItem `json:"items,omitempty"` // populated on read
}

type PlaylistItem struct {
	ID              string    `json:"id" db:"id"`
	PlaylistID      string    `json:"playlist_id" db:"playlist_id"`
	ContentType     string    `json:"content_type" db:"content_type"`
	FilePath        string    `json:"file_path" db:"file_path"`
	DisplayName     *string   `json:"display_name" db:"display_name"`
	SortOrder       int       `json:"sort_order" db:"sort_order"`
	DurationSeconds *int      `json:"duration_seconds" db:"duration_seconds"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type Schedule struct {
	ID         string        `json:"id" db:"id"`
	DeviceID   string        `json:"device_id" db:"device_id"`
	PlaylistID string        `json:"playlist_id" db:"playlist_id"`
	StartTime  string        `json:"start_time" db:"start_time"` // time.Time mapped as string for TIME type
	EndTime    string        `json:"end_time" db:"end_time"`
	DaysOfWeek pq.Int64Array `json:"days_of_week" db:"days_of_week"`
	IsActive   bool          `json:"is_active" db:"is_active"`
	CreatedAt  time.Time     `json:"created_at" db:"created_at"`
}
