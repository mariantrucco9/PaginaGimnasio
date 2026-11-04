package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"workout-tracker/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type programRequest struct {
	Name string              `json:"name"`
	Days []programDayRequest `json:"days"`
}

type programDayRequest struct {
	ID        uint     `json:"id"`
	Name      string   `json:"name"`
	Exercises []string `json:"exercises"`
}

var errDuplicateProgramDay = errors.New("day id appears more than once")

func ListPrograms(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		programs := make([]models.RoutineProgram, 0)
		err := db.
			Preload("Days", func(query *gorm.DB) *gorm.DB {
				return query.Where("is_active = ?", true).Order("program_order ASC, id ASC")
			}).
			Preload("Days.Exercises", func(query *gorm.DB) *gorm.DB {
				return query.Order("sort_order ASC")
			}).
			Preload("Days.Exercises.Exercise").
			Where("user_id = ? AND is_active = ?", userID, true).
			Order("created_at ASC").
			Find(&programs).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load routine programs"})
			return
		}
		c.JSON(http.StatusOK, programs)
	}
}

func CreateProgram(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		var request programRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if message := validateProgramRequest(request); message != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": message})
			return
		}

		var program models.RoutineProgram
		err := db.Transaction(func(tx *gorm.DB) error {
			program = models.RoutineProgram{
				UserID:   userID,
				Name:     strings.TrimSpace(request.Name),
				IsActive: true,
			}
			if err := tx.Create(&program).Error; err != nil {
				return err
			}
			for index, day := range request.Days {
				routine := models.Routine{
					UserID:       userID,
					ProgramID:    &program.ID,
					ProgramOrder: index + 1,
					Name:         strings.TrimSpace(day.Name),
					IsActive:     true,
				}
				if err := tx.Create(&routine).Error; err != nil {
					return err
				}
				if err := replaceDayExercises(tx, &routine, day.Exercises); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create routine program"})
			return
		}

		if err := loadProgram(db, &program, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load created routine program"})
			return
		}
		c.JSON(http.StatusCreated, program)
	}
}

func UpdateProgram(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		programID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || programID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid routine program id"})
			return
		}
		var request programRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if message := validateProgramRequest(request); message != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": message})
			return
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			var program models.RoutineProgram
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND user_id = ? AND is_active = ?", programID, userID, true).
				First(&program).Error; err != nil {
				return err
			}
			if err := tx.Model(&program).Update("name", strings.TrimSpace(request.Name)).Error; err != nil {
				return err
			}

			var existingDays []models.Routine
			if err := tx.Where("program_id = ?", program.ID).Find(&existingDays).Error; err != nil {
				return err
			}
			availableDays := make(map[uint]models.Routine, len(existingDays))
			for _, day := range existingDays {
				availableDays[day.ID] = day
			}
			keptDays := make(map[uint]struct{}, len(request.Days))

			for index, dayInput := range request.Days {
				var day models.Routine
				if dayInput.ID != 0 {
					existing, exists := availableDays[dayInput.ID]
					if !exists {
						return gorm.ErrRecordNotFound
					}
					if _, duplicate := keptDays[dayInput.ID]; duplicate {
						return errDuplicateProgramDay
					}
					day = existing
					if err := tx.Model(&day).Updates(map[string]interface{}{
						"name":          strings.TrimSpace(dayInput.Name),
						"program_order": index + 1,
						"is_active":     true,
					}).Error; err != nil {
						return err
					}
				} else {
					day = models.Routine{
						UserID:       userID,
						ProgramID:    &program.ID,
						ProgramOrder: index + 1,
						Name:         strings.TrimSpace(dayInput.Name),
						IsActive:     true,
					}
					if err := tx.Create(&day).Error; err != nil {
						return err
					}
				}
				keptDays[day.ID] = struct{}{}
				if err := replaceDayExercises(tx, &day, dayInput.Exercises); err != nil {
					return err
				}
			}

			for _, day := range existingDays {
				if _, keep := keptDays[day.ID]; keep {
					continue
				}
				if err := tx.Model(&day).Update("is_active", false).Error; err != nil {
					return err
				}
			}
			return nil
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "routine program or day not found"})
			return
		}
		if errors.Is(err, errDuplicateProgramDay) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a day can only appear once in the routine"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update routine program"})
			return
		}

		var program models.RoutineProgram
		if err := loadProgram(db, &program, userID, uint(programID)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load updated routine program"})
			return
		}
		c.JSON(http.StatusOK, program)
	}
}

func DeleteProgram(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := authenticatedUserID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		programID, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || programID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid routine program id"})
			return
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			var program models.RoutineProgram
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND user_id = ? AND is_active = ?", programID, userID, true).
				First(&program).Error; err != nil {
				return err
			}
			if err := tx.Model(&program).Update("is_active", false).Error; err != nil {
				return err
			}
			return tx.Model(&models.Routine{}).
				Where("program_id = ?", program.ID).
				Update("is_active", false).Error
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "routine program not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete routine program"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func validateProgramRequest(request programRequest) string {
	name := strings.TrimSpace(request.Name)
	if name == "" || utf8.RuneCountInString(name) > 120 {
		return "name must contain between 1 and 120 characters"
	}
	if len(request.Days) == 0 || len(request.Days) > 14 {
		return "a routine program must contain between 1 and 14 days"
	}
	for _, day := range request.Days {
		dayName := strings.TrimSpace(day.Name)
		if dayName == "" || utf8.RuneCountInString(dayName) > 120 {
			return "each day must have a name of at most 120 characters"
		}
		if len(day.Exercises) > 50 {
			return "each day can contain at most 50 exercises"
		}
		for _, exerciseName := range day.Exercises {
			name := strings.TrimSpace(exerciseName)
			if name == "" || utf8.RuneCountInString(name) > 120 {
				return "exercise names must contain between 1 and 120 characters"
			}
		}
	}
	return ""
}

func replaceDayExercises(tx *gorm.DB, routine *models.Routine, names []string) error {
	if err := tx.Where("routine_id = ?", routine.ID).Delete(&models.RoutineExercise{}).Error; err != nil {
		return err
	}
	for index, name := range names {
		name = strings.TrimSpace(name)
		exercise := models.Exercise{Name: name}
		if err := tx.Where("name = ?", name).FirstOrCreate(&exercise).Error; err != nil {
			return err
		}
		link := models.RoutineExercise{
			RoutineID:  routine.ID,
			ExerciseID: exercise.ID,
			SortOrder:  index + 1,
		}
		if err := tx.Create(&link).Error; err != nil {
			return err
		}
	}
	return nil
}

func loadProgram(db *gorm.DB, program *models.RoutineProgram, userID uint, id ...uint) error {
	query := db.
		Preload("Days", func(query *gorm.DB) *gorm.DB {
			return query.Where("is_active = ?", true).Order("program_order ASC, id ASC")
		}).
		Preload("Days.Exercises", func(query *gorm.DB) *gorm.DB {
			return query.Order("sort_order ASC")
		}).
		Preload("Days.Exercises.Exercise").
		Where("user_id = ?", userID)
	if len(id) > 0 {
		query = query.Where("id = ?", id[0])
	}
	return query.First(program).Error
}
