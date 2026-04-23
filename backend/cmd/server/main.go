package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"welcome-board-backend/internal/handler"
	"welcome-board-backend/internal/hub"
	"welcome-board-backend/internal/repository"
	"welcome-board-backend/internal/service"
)

func main() {
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err := repository.InitDB(dbUrl)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := repository.RunMigrations(dbUrl); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	repo := repository.NewRepository(db)

	h := hub.NewHub()
	go h.Run()

	svc := service.NewService(repo, h)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := svc.EnsurePreviewDevice(ctx); err != nil {
		log.Printf("Warning: failed to ensure preview device: %v", err)
	}
	cancel()

	svc.StartScheduler()
	defer svc.Shutdown()

	mediaDir := os.Getenv("MEDIA_DIR")
	if mediaDir == "" {
		mediaDir = "./media"
	}
	if err := os.MkdirAll(mediaDir, 0755); err != nil {
		log.Fatalf("Failed to create media directory: %v", err)
	}

	hand := handler.NewHandler(svc, h, mediaDir)

	r := gin.Default()
	r.MaxMultipartMemory = 32 << 20 // 32 MB in memory; remainder streamed to temp files

	r.Static("/media", mediaDir)

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true

	v1 := r.Group("/api/v1")
	v1.Use(cors.New(config))
	{
		v1.GET("/health", hand.HealthCheck)
		v1.GET("/devices", hand.GetDevices)
		v1.POST("/devices", hand.CreateDevice)
		v1.POST("/devices/:deviceId/push", hand.PushToDevice)

		v1.GET("/playlists", hand.GetPlaylists)
		v1.POST("/playlists", hand.CreatePlaylist)
		v1.GET("/playlists/:id", hand.GetPlaylist)
		v1.PUT("/playlists/:id", hand.UpdatePlaylist)
		v1.DELETE("/playlists/:id", hand.DeletePlaylist)
		v1.POST("/playlists/:id/items", hand.AddPlaylistItem)
		v1.PUT("/playlists/:id/items/:itemId", hand.UpdatePlaylistItem)
		v1.DELETE("/playlists/:id/items/:itemId", hand.DeletePlaylistItem)

		v1.POST("/upload", hand.UploadMedia)
		v1.GET("/media-library", hand.GetMediaLibrary)
		v1.DELETE("/media/:filename", hand.DeleteMedia)

		v1.GET("/system/storage", hand.GetSystemStorage)

		v1.GET("/schedules", hand.GetSchedules)
		v1.POST("/schedules", hand.CreateSchedule)
		v1.DELETE("/schedules/:id", hand.DeleteSchedule)
	}

	r.GET("/ws", hand.ServeWs)
	r.GET("/", hand.ServeRootDisplay)
	r.GET("/display", hand.ServeRootDisplay)
	r.GET("/display/:deviceId", hand.ServeDisplay)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  600 * time.Second, // 10 min — allows 1 GB uploads on slow links
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in background goroutine
	go func() {
		log.Printf("Server listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Block until SIGINT or SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown signal received — draining connections…")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	log.Println("Server stopped cleanly")
}