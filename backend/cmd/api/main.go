package main

import (
	"log"
	"os"
	"strconv"

	"workout-tracker/backend/internal/database"
	"workout-tracker/backend/internal/handlers"
	"workout-tracker/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	db, err := database.Open()
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	pinSecret := []byte(os.Getenv("PIN_HMAC_SECRET"))
	ttlHours, err := strconv.Atoi(envOr("JWT_TTL_HOURS", "24"))
	if err != nil || ttlHours < 1 {
		log.Fatal("JWT_TTL_HOURS must be a positive integer")
	}
	if len(jwtSecret) < 32 || len(pinSecret) < 32 {
		log.Fatal("JWT_SECRET and PIN_HMAC_SECRET must each be at least 32 bytes")
	}

	router := gin.Default()
	router.Use(middleware.CORS(envOr("FRONTEND_ORIGIN", "http://localhost:5173")))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	api := router.Group("/api")
	api.POST("/auth/login", handlers.Login(db, pinSecret, jwtSecret, ttlHours))
	protected := api.Group("")
	protected.Use(middleware.RequireAuth(jwtSecret))
	protected.GET("/programs", handlers.ListPrograms(db))
	protected.POST("/programs", handlers.CreateProgram(db))
	protected.PUT("/programs/:id", handlers.UpdateProgram(db))
	protected.DELETE("/programs/:id", handlers.DeleteProgram(db))
	protected.GET("/routines", handlers.ListRoutines(db))
	protected.POST("/workouts", handlers.StartWorkout(db))
	protected.GET("/workouts/:id", handlers.GetWorkout(db))
	protected.POST("/workouts/:id/complete", handlers.CompleteWorkout(db))
	protected.POST("/exercise-logs/:id/sets", handlers.AddSet(db))
	protected.POST("/workouts/:id/extra-exercise", handlers.AddExtraExercise(db))
	protected.GET("/routines/:id/workouts", handlers.ListPastWorkouts(db))
	protected.GET("/calendar", handlers.Calendar(db))

	port := envOr("PORT", "8080")
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("start server: %v", err)
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
