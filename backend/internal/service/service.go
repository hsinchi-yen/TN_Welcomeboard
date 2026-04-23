package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"welcome-board-backend/internal/hub"
	"welcome-board-backend/internal/model"
	"welcome-board-backend/internal/repository"

	"github.com/go-co-op/gocron/v2"
)

const PreviewDeviceID = "00000000-0000-0000-0000-000000000001"

const PreviewDeviceName = "Local Preview Screen"

type Service struct {
	repo      *repository.Repository
	hub       *hub.Hub
	scheduler gocron.Scheduler
}

func NewService(repo *repository.Repository, h *hub.Hub) *Service {
	return &Service{repo: repo, hub: h}
}

func (s *Service) Repo() *repository.Repository {
	return s.repo
}

func (s *Service) Hub() *hub.Hub {
	return s.hub
}

func (s *Service) EnsurePreviewDevice(ctx context.Context) error {
	description := "Built-in preview device available at localhost:8080"
	device := &model.Device{
		ID:          PreviewDeviceID,
		Name:        PreviewDeviceName,
		Description: &description,
	}
	return s.repo.EnsureDevice(ctx, device)
}

func (s *Service) StartScheduler() {
	sch, err := gocron.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}

	_, err = sch.NewJob(
		gocron.CronJob("* * * * *", false),
		gocron.NewTask(s.checkSchedules),
	)
	if err != nil {
		log.Fatalf("Failed to create scheduler job: %v", err)
	}

	sch.Start()
	s.scheduler = sch
	log.Println("Scheduler started")
}

// Shutdown stops the scheduler gracefully. Call before process exit.
func (s *Service) Shutdown() {
	if s.scheduler != nil {
		if err := s.scheduler.Shutdown(); err != nil {
			log.Printf("Scheduler shutdown error: %v", err)
		} else {
			log.Println("Scheduler stopped")
		}
	}
}

func (s *Service) checkSchedules() {
	// Bounded context so a hung DB call never blocks the next tick.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	schedules, err := s.repo.GetSchedules(ctx)
	if err != nil {
		log.Printf("Scheduler: error fetching schedules: %v", err)
		return
	}

	now := time.Now()
	currentDay := int64(now.Weekday())

	for _, sched := range schedules {
		if !sched.IsActive {
			continue
		}

		dayMatch := false
		for _, d := range sched.DaysOfWeek {
			if d == currentDay {
				dayMatch = true
				break
			}
		}
		if !dayMatch {
			continue
		}

		schedStart := sched.StartTime
		if len(schedStart) >= 5 {
			schedStart = schedStart[:5]
		}

		nowH, nowM, _ := now.Clock()
		nowStr := fmt.Sprintf("%02d:%02d", nowH, nowM)

		if nowStr != schedStart {
			continue
		}

		playlist, err := s.repo.GetPlaylist(ctx, sched.PlaylistID)
		if err != nil {
			log.Printf("Scheduler: error fetching playlist %s: %v", sched.PlaylistID, err)
			continue
		}

		payload := map[string]interface{}{
			"playlist_id":        playlist.ID,
			"mode":               playlist.Mode,
			"transition_seconds": playlist.TransitionSeconds,
			"items":              playlist.Items,
		}
		payloadBytes, _ := json.Marshal(payload)

		s.hub.BroadcastToDevice(sched.DeviceID, hub.Message{
			Type:     hub.MsgSwitchPlaylist,
			DeviceID: sched.DeviceID,
			Payload:  payloadBytes,
		})
		log.Printf("Scheduler: pushed playlist %s to device %s", sched.PlaylistID, sched.DeviceID)
	}
}