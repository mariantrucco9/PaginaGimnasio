package handlers

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"workout-tracker/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var errRoutineNotFound = errors.New("routine not found")
var errWorkoutNotFound = errors.New("workout not found")
var errExerciseNotFound = errors.New("exercise not found")
var errExerciseLogNotFound = errors.New("exercise log not found")
var errWorkoutCompleted = errors.New("workout already completed")

type workoutRequest struct {
	RoutineID uint   `json:"routineId" binding:"required"`
	Date      string `json:"date" binding:"required"`
}

type setRequest struct {
	Weight     *float64 `json:"weight"`
	Reps       *int     `json:"reps"`
	WeightUnit string   `json:"weightUnit"`
}

type extraExerciseRequest struct {
	ExerciseID   *uint  `json:"exerciseId"`
	ExerciseName string `json:"exerciseName"`
}

func StartWorkout(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		var request workoutRequest
		if err := c.ShouldBindJSON(&request); err != nil || request.RoutineID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "routineId and date are required"})
			return
		}
		workoutDate, err := time.Parse("2006-01-02", request.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "date must use YYYY-MM-DD format"})
			return
		}

		created := false
		err = db.Transaction(func(tx *gorm.DB) error {
			var routine models.Routine
			if err := tx.Where("id = ? AND user_id = ?", request.RoutineID, userID).
				First(&routine).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errRoutineNotFound
				}
				return err
			}

			var routineExercises []models.RoutineExercise
			if err := tx.Preload("Exercise").
				Where("routine_id = ?", routine.ID).
				Order("sort_order ASC").
				Find(&routineExercises).Error; err != nil {
				return err
			}

			workout := models.WorkoutLog{
				UserID:    userID,
				RoutineID: routine.ID,
				Date:      workoutDate,
			}
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&workout)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return nil
			}
			created = true

			for _, routineExercise := range routineExercises {
				exerciseID := routineExercise.ExerciseID
				exerciseLog := models.ExerciseLog{
					WorkoutLogID:      workout.ID,
					RoutineExerciseID: &routineExercise.ID,
					ExerciseID:        &exerciseID,
					ExerciseName:      routineExercise.Exercise.Name,
					SortOrder:         routineExercise.SortOrder,
				}
				if err := tx.Create(&exerciseLog).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if errors.Is(err, errRoutineNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "routine not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start workout"})
			return
		}

		var workout models.WorkoutLog
		err = db.Preload("Exercises", func(query *gorm.DB) *gorm.DB {
			return query.Order("sort_order ASC")
		}).
			Preload("Exercises.Sets", func(query *gorm.DB) *gorm.DB {
				return query.Order("set_number ASC")
			}).
			Where("user_id = ? AND routine_id = ? AND date = ?", userID, request.RoutineID, workoutDate).
			First(&workout).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load workout"})
			return
		}

		status := http.StatusOK
		if created {
			status = http.StatusCreated
		}
		c.JSON(status, workout)
	}
}

func AddSet(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		exerciseLogID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || exerciseLogID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid exercise log id"})
			return
		}
		var request setRequest
		if err := c.ShouldBindJSON(&request); err != nil ||
			request.Weight == nil || request.Reps == nil ||
			math.IsNaN(*request.Weight) || math.IsInf(*request.Weight, 0) ||
			*request.Weight < 0 || *request.Reps < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "weight must be non-negative and reps must be positive"})
			return
		}
		if request.WeightUnit == "" {
			request.WeightUnit = "kg"
		}
		if request.WeightUnit != "kg" && request.WeightUnit != "lb" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "weightUnit must be kg or lb"})
			return
		}

		var savedSet models.Set
		err = db.Transaction(func(tx *gorm.DB) error {
			var exerciseLog models.ExerciseLog
			err := tx.Select("exercise_logs.*").
				Joins("JOIN workout_logs ON workout_logs.id = exercise_logs.workout_log_id").
				Where("exercise_logs.id = ? AND workout_logs.user_id = ?", exerciseLogID, userID).
				First(&exerciseLog).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errExerciseLogNotFound
			}
			if err != nil {
				return err
			}

			var workout models.WorkoutLog
			err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND user_id = ?", exerciseLog.WorkoutLogID, userID).
				First(&workout).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errExerciseLogNotFound
			}
			if err != nil {
				return err
			}
			if workout.CompletedAt != nil {
				return errWorkoutCompleted
			}

			var lastSet models.Set
			err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("exercise_log_id = ?", exerciseLog.ID).
				Order("set_number DESC").
				First(&lastSet).Error
			nextSetNumber := 1
			if err == nil {
				nextSetNumber = lastSet.SetNumber + 1
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			savedSet = models.Set{
				ExerciseLogID: exerciseLog.ID,
				SetNumber:     nextSetNumber,
				Weight:        *request.Weight,
				WeightUnit:    request.WeightUnit,
				Reps:          *request.Reps,
			}
			return tx.Create(&savedSet).Error
		})
		if errors.Is(err, errExerciseLogNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "exercise log not found"})
			return
		}
		if errors.Is(err, errWorkoutCompleted) {
			c.JSON(http.StatusConflict, gin.H{"error": "workout is already completed"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save set"})
			return
		}
		c.JSON(http.StatusCreated, savedSet)
	}
}

func AddExtraExercise(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		workoutID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || workoutID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workout id"})
			return
		}
		var request extraExerciseRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		request.ExerciseName = strings.TrimSpace(request.ExerciseName)
		if request.ExerciseName == "" || utf8.RuneCountInString(request.ExerciseName) > 120 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "exerciseName must contain between 1 and 120 characters"})
			return
		}
		if request.ExerciseID != nil && *request.ExerciseID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "exerciseId must be positive"})
			return
		}

		var exerciseLog models.ExerciseLog
		err = db.Transaction(func(tx *gorm.DB) error {
			var workout models.WorkoutLog
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND user_id = ?", workoutID, userID).
				First(&workout).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errWorkoutNotFound
				}
				return err
			}
			if workout.CompletedAt != nil {
				return errWorkoutCompleted
			}

			if request.ExerciseID != nil {
				var exercise models.Exercise
				if err := tx.First(&exercise, *request.ExerciseID).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						return errExerciseNotFound
					}
					return err
				}
			}

			var sortOrder int
			if err := tx.Model(&models.ExerciseLog{}).
				Where("workout_log_id = ?", workout.ID).
				Select("COALESCE(MAX(sort_order), -1)").
				Scan(&sortOrder).Error; err != nil {
				return err
			}
			exerciseLog = models.ExerciseLog{
				WorkoutLogID: workout.ID,
				ExerciseID:   request.ExerciseID,
				ExerciseName: request.ExerciseName,
				SortOrder:    sortOrder + 1,
			}
			return tx.Create(&exerciseLog).Error
		})
		if errors.Is(err, errWorkoutNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "workout not found"})
			return
		}
		if errors.Is(err, errExerciseNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "exercise not found"})
			return
		}
		if errors.Is(err, errWorkoutCompleted) {
			c.JSON(http.StatusConflict, gin.H{"error": "workout is already completed"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add extra exercise"})
			return
		}
		c.JSON(http.StatusCreated, exerciseLog)
	}
}

func ListPastWorkouts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		routineID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || routineID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid routine id"})
			return
		}

		var routine models.Routine
		if err := db.Where("id = ? AND user_id = ?", routineID, userID).First(&routine).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "routine not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load routine"})
			return
		}

		type workoutSummary struct {
			ID          uint       `json:"id"`
			Date        string     `json:"date"`
			CompletedAt *time.Time `json:"completedAt,omitempty"`
		}
		workouts := make([]workoutSummary, 0)
		err = db.Table("workout_logs").
			Select("workout_logs.id, DATE_FORMAT(workout_logs.date, '%Y-%m-%d') AS date, workout_logs.completed_at").
			Where(`workout_logs.user_id = ? AND workout_logs.routine_id = ? AND workout_logs.date < CURDATE()
				AND (workout_logs.completed_at IS NOT NULL OR EXISTS (
					SELECT 1
					FROM exercise_logs
					JOIN sets ON sets.exercise_log_id = exercise_logs.id
					WHERE exercise_logs.workout_log_id = workout_logs.id
				))`, userID, routine.ID).
			Order("workout_logs.date DESC").
			Scan(&workouts).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load past workouts"})
			return
		}
		c.JSON(http.StatusOK, workouts)
	}
}

func GetWorkout(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		workoutID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || workoutID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workout id"})
			return
		}

		var workout models.WorkoutLog
		err = db.Preload("Exercises", func(query *gorm.DB) *gorm.DB {
			return query.Order("sort_order ASC")
		}).
			Preload("Exercises.Sets", func(query *gorm.DB) *gorm.DB {
				return query.Order("set_number ASC")
			}).
			Where("id = ? AND user_id = ?", workoutID, userID).
			First(&workout).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "workout not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load workout"})
			return
		}
		c.JSON(http.StatusOK, workout)
	}
}

func CompleteWorkout(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		workoutID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || workoutID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workout id"})
			return
		}

		var workout models.WorkoutLog
		err = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND user_id = ?", workoutID, userID).
				First(&workout).Error; err != nil {
				return err
			}
			if workout.CompletedAt == nil {
				completedAt := time.Now().UTC()
				if err := tx.Model(&workout).Update("completed_at", completedAt).Error; err != nil {
					return err
				}
				workout.CompletedAt = &completedAt
			}
			return nil
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "workout not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete workout"})
			return
		}
		c.JSON(http.StatusOK, workout)
	}
}

func Calendar(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		var activityDates []string
		err := db.Table("workout_logs").
			Select("DATE_FORMAT(workout_logs.date, '%Y-%m-%d')").
			Where(`workout_logs.user_id = ? AND (
				workout_logs.completed_at IS NOT NULL OR EXISTS (
					SELECT 1
					FROM exercise_logs
					JOIN sets ON sets.exercise_log_id = exercise_logs.id
					WHERE exercise_logs.workout_log_id = workout_logs.id
				)
			)`, userID).
			Group("workout_logs.date").
			Order("workout_logs.date ASC").
			Pluck("DATE_FORMAT(workout_logs.date, '%Y-%m-%d')", &activityDates).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load calendar activity"})
			return
		}
		if activityDates == nil {
			activityDates = []string{}
		}
		c.JSON(http.StatusOK, activityDates)
	}
}

func authenticatedUserID(c *gin.Context) (uint, bool) {
	value, ok := c.Get("userID")
	if !ok {
		return 0, false
	}
	userID, ok := value.(uint)
	return userID, ok && userID > 0
}
