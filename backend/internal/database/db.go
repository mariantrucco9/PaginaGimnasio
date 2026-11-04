package database

import (
	"fmt"
	"os"
	"time"

	"workout-tracker/backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open() (*gorm.DB, error) {
	dsn, err := requiredEnv("DB_URL")
	if err != nil {
		return nil, err
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect to PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get underlying database connection: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	if err := db.AutoMigrate(
		&models.User{},
		&models.RoutineProgram{},
		&models.Routine{},
		&models.Exercise{},
		&models.RoutineExercise{},
		&models.WorkoutLog{},
		&models.ExerciseLog{},
		&models.Set{},
	); err != nil {
		return nil, fmt.Errorf("migrate database schema: %w", err)
	}
	if db.Migrator().HasIndex(&models.Routine{}, "idx_routine_user_name") {
		if err := db.Migrator().DropIndex(&models.Routine{}, "idx_routine_user_name"); err != nil {
			return nil, fmt.Errorf("remove legacy routine name constraint: %w", err)
		}
	}
	if err := backfillPowerbuildingProgram(db); err != nil {
		return nil, fmt.Errorf("group existing Powerbuilding days: %w", err)
	}
	return db, nil
}

func backfillPowerbuildingProgram(db *gorm.DB) error {
	const ownerID = uint(1)
	days := []string{
		"Día 1: Sentadilla (Fuerza)",
		"Día 2: Press Banca (Fuerza)",
		"Día 3: Peso Muerto (Fuerza)",
		"Día 4: Piernas (Hipertrofia)",
		"Día 5: Empuje (Hipertrofia)",
		"Día 6: Tirón (Hipertrofia)",
	}

	var count int64
	if err := db.Model(&models.Routine{}).
		Where("user_id = ? AND name IN ?", ownerID, days).
		Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(days)) {
		return nil
	}

	return db.Transaction(func(tx *gorm.DB) error {
		program := models.RoutineProgram{
			UserID:   ownerID,
			Name:     "Rutina PowerBuilding",
			IsActive: true,
		}
		if err := tx.Where("user_id = ? AND name = ?", ownerID, program.Name).
			FirstOrCreate(&program).Error; err != nil {
			return err
		}
		for index, name := range days {
			if err := tx.Model(&models.Routine{}).
				Where("user_id = ? AND name = ? AND program_id IS NULL", ownerID, name).
				Updates(map[string]interface{}{
					"program_id":    program.ID,
					"program_order": index + 1,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func requiredEnv(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("required environment variable is not set: %s", key)
	}
	return value, nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
