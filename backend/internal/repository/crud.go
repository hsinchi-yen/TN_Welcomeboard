package repository

import (
	"context"

	"welcome-board-backend/internal/model"
)

func (r *Repository) EnsureDevice(ctx context.Context, d *model.Device) error {
	query := `
		INSERT INTO devices (id, name, description)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description
		RETURNING created_at, last_seen_at
	`
	return r.db.QueryRowContext(ctx, query, d.ID, d.Name, d.Description).Scan(&d.CreatedAt, &d.LastSeenAt)
}

// Devices
func (r *Repository) GetDevices(ctx context.Context) ([]model.Device, error) {
	devices := []model.Device{}
	err := r.db.SelectContext(ctx, &devices, "SELECT * FROM devices ORDER BY created_at DESC")
	return devices, err
}

func (r *Repository) CreateDevice(ctx context.Context, d *model.Device) error {
	query := `INSERT INTO devices (name, description) VALUES ($1, $2) RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query, d.Name, d.Description).Scan(&d.ID, &d.CreatedAt)
}

// Playlists
func (r *Repository) GetPlaylists(ctx context.Context) ([]model.Playlist, error) {
	playlists := []model.Playlist{}
	query := `
		SELECT p.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count 
		FROM playlists p 
		ORDER BY updated_at DESC
	`
	err := r.db.SelectContext(ctx, &playlists, query)
	return playlists, err
}

func (r *Repository) GetPlaylist(ctx context.Context, id string) (*model.Playlist, error) {
	var playlist model.Playlist
	err := r.db.GetContext(ctx, &playlist, "SELECT * FROM playlists WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	items := []model.PlaylistItem{}
	err = r.db.SelectContext(ctx, &items, "SELECT * FROM playlist_items WHERE playlist_id = $1 ORDER BY sort_order ASC", id)
	if err != nil {
		return nil, err
	}
	playlist.Items = items
	return &playlist, nil
}

func (r *Repository) CreatePlaylist(ctx context.Context, p *model.Playlist) error {
	query := `INSERT INTO playlists (name, mode, transition_seconds) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query, p.Name, p.Mode, p.TransitionSeconds).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *Repository) UpdatePlaylist(ctx context.Context, id string, p *model.Playlist) error {
	query := `UPDATE playlists SET name = $1, mode = $2, transition_seconds = $3, updated_at = NOW() WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, p.Name, p.Mode, p.TransitionSeconds, id)
	return err
}

func (r *Repository) DeletePlaylist(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM playlists WHERE id = $1", id)
	return err
}

// Playlist Items
func (r *Repository) AddPlaylistItem(ctx context.Context, item *model.PlaylistItem) error {
	query := `
		INSERT INTO playlist_items (playlist_id, content_type, file_path, display_name, sort_order, duration_seconds)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query, item.PlaylistID, item.ContentType, item.FilePath, item.DisplayName, item.SortOrder, item.DurationSeconds).Scan(&item.ID, &item.CreatedAt)
}

func (r *Repository) UpdatePlaylistItem(ctx context.Context, id string, duration int, sortOrder int) error {
	_, err := r.db.ExecContext(ctx, "UPDATE playlist_items SET duration_seconds = $1, sort_order = $2 WHERE id = $3", duration, sortOrder, id)
	return err
}

func (r *Repository) DeletePlaylistItem(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM playlist_items WHERE id = $1", id)
	return err
}

// Schedules
func (r *Repository) GetSchedules(ctx context.Context) ([]model.Schedule, error) {
	schedules := []model.Schedule{}
	err := r.db.SelectContext(ctx, &schedules, "SELECT * FROM schedules ORDER BY created_at DESC")
	return schedules, err
}

func (r *Repository) CreateSchedule(ctx context.Context, s *model.Schedule) error {
	query := `
		INSERT INTO schedules (device_id, playlist_id, start_time, end_time, days_of_week, is_active)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query, s.DeviceID, s.PlaylistID, s.StartTime, s.EndTime, s.DaysOfWeek, s.IsActive).Scan(&s.ID, &s.CreatedAt)
}

func (r *Repository) DeleteSchedule(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM schedules WHERE id = $1", id)
	return err
}