package main

import (
	"fmt"
	"log"

	"workout-tracker/backend/internal/database"
	"workout-tracker/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const userID = uint(1)

type routineSeed struct {
	name      string
	exercises []string
}

var powerbuildingRoutines = []routineSeed{
	{
		name: "Día 1: Sentadilla (Fuerza)",
		exercises: []string{
			"Sentadilla Libre",
			"Sentadilla Búlgara",
			"Curl Femoral",
			"Elevación de Pantorrillas",
		},
	},
	{
		name: "Día 2: Press Banca (Fuerza)",
		exercises: []string{
			"Press de Banca",
			"Press Militar con Mancuernas",
			"Fondos en Paralelas",
			"Elevaciones Laterales",
			"Extensión de Tríceps en Polea",
		},
	},
	{
		name: "Día 3: Peso Muerto (Fuerza)",
		exercises: []string{
			"Peso Muerto",
			"Remo con Barra",
			"Dominadas",
			"Face Pulls",
			"Curl de Bíceps con Barra Z",
		},
	},
	{
		name: "Día 4: Piernas (Hipertrofia)",
		exercises: []string{
			"Prensa de Piernas",
			"Peso Muerto Rumano",
			"Extensiones de Cuádriceps",
			"Curl Femoral Sentado",
			"Elevaciones de Gemelo Sentado",
		},
	},
	{
		name: "Día 5: Empuje (Hipertrofia)",
		exercises: []string{
			"Press Inclinado con Mancuernas",
			"Cruces en Polea",
			"Press de Hombro en Máquina",
			"Elevaciones Laterales con Cable",
			"Rompecráneos",
		},
	},
	{
		name: "Día 6: Tirón (Hipertrofia)",
		exercises: []string{
			"Jalón al Pecho",
			"Remo en Polea Baja",
			"Pullover en Polea Alta",
			"Curl Martillo",
			"Vuelos Posteriores",
		},
	},
}

func main() {
	db, err := database.Open()
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("get underlying database connection: %v", err)
	}
	defer sqlDB.Close()

	if err := seed(db, userID); err != nil {
		log.Fatalf("seed Powerbuilding program: %v", err)
	}
	fmt.Printf("Seeded %d Powerbuilding routines for user %d.\n", len(powerbuildingRoutines), userID)
}

func seed(db *gorm.DB, ownerID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.First(&user, ownerID).Error; err != nil {
			return fmt.Errorf("find user %d: %w", ownerID, err)
		}

		program := models.RoutineProgram{
			UserID:   user.ID,
			Name:     "Rutina PowerBuilding",
			IsActive: true,
		}
		if err := tx.Where("user_id = ? AND name = ?", user.ID, program.Name).
			FirstOrCreate(&program).Error; err != nil {
			return fmt.Errorf("ensure Powerbuilding program: %w", err)
		}

		exercises := make(map[string]models.Exercise)
		for _, routine := range powerbuildingRoutines {
			for _, name := range routine.exercises {
				if _, exists := exercises[name]; exists {
					continue
				}

				exercise := models.Exercise{Name: name}
				if err := tx.Where("name = ?", name).FirstOrCreate(&exercise).Error; err != nil {
					return fmt.Errorf("ensure exercise %q: %w", name, err)
				}
				exercises[name] = exercise
			}
		}

		for routineIndex, routineDefinition := range powerbuildingRoutines {
			routine := models.Routine{
				UserID:       user.ID,
				ProgramID:    &program.ID,
				ProgramOrder: routineIndex + 1,
				Name:         routineDefinition.name,
				IsActive:     true,
			}
			if err := tx.Where("user_id = ? AND name = ?", user.ID, routineDefinition.name).
				FirstOrCreate(&routine).Error; err != nil {
				return fmt.Errorf("ensure routine %q: %w", routineDefinition.name, err)
			}
			if err := tx.Model(&routine).Updates(map[string]interface{}{
				"program_id":    program.ID,
				"program_order": routineIndex + 1,
				"is_active":     true,
			}).Error; err != nil {
				return fmt.Errorf("assign routine %q to Powerbuilding program: %w", routineDefinition.name, err)
			}

			for index, exerciseName := range routineDefinition.exercises {
				link := models.RoutineExercise{
					RoutineID:  routine.ID,
					ExerciseID: exercises[exerciseName].ID,
					SortOrder:  index + 1,
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns: []clause.Column{
						{Name: "routine_id"},
						{Name: "sort_order"},
					},
					DoUpdates: clause.AssignmentColumns([]string{"exercise_id"}),
				}).Create(&link).Error; err != nil {
					return fmt.Errorf(
						"link exercise %q to routine %q: %w",
						exerciseName,
						routineDefinition.name,
						err,
					)
				}
			}
		}
		return nil
	})
}
