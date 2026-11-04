package models

import "time"

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PinDigest string    `gorm:"size:64;not null;uniqueIndex" json:"-"`
	Name      string    `gorm:"size:100" json:"name,omitempty"`
	Routines  []Routine `json:"routines,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Routine struct {
	ID           uint              `gorm:"primaryKey" json:"id"`
	UserID       uint              `gorm:"not null;index" json:"userId"`
	ProgramID    *uint             `gorm:"index" json:"programId,omitempty"`
	ProgramOrder int               `gorm:"not null;default:0" json:"programOrder"`
	Name         string            `gorm:"size:120;not null;index" json:"name"`
	Description  string            `gorm:"size:500" json:"description,omitempty"`
	IsActive     bool              `gorm:"not null;default:true" json:"isActive"`
	Exercises    []RoutineExercise `gorm:"constraint:OnDelete:CASCADE" json:"exercises,omitempty"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

type RoutineProgram struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index;uniqueIndex:idx_program_user_name,priority:1" json:"userId"`
	Name      string    `gorm:"size:120;not null;uniqueIndex:idx_program_user_name,priority:2" json:"name"`
	IsActive  bool      `gorm:"not null;default:true;index" json:"isActive"`
	Days      []Routine `gorm:"foreignKey:ProgramID" json:"days,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Exercise struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:120;not null;uniqueIndex" json:"name"`
	Muscle    string    `gorm:"size:80" json:"muscle,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type RoutineExercise struct {
	ID         uint     `gorm:"primaryKey" json:"id"`
	RoutineID  uint     `gorm:"not null;uniqueIndex:idx_routine_exercise_order,priority:1" json:"routineId"`
	ExerciseID uint     `gorm:"not null" json:"exerciseId"`
	SortOrder  int      `gorm:"not null;uniqueIndex:idx_routine_exercise_order,priority:2" json:"sortOrder"`
	Exercise   Exercise `gorm:"constraint:OnDelete:RESTRICT" json:"exercise"`
}

type WorkoutLog struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	UserID      uint          `gorm:"not null;index;uniqueIndex:idx_workout_user_routine_date,priority:1" json:"userId"`
	RoutineID   uint          `gorm:"not null;uniqueIndex:idx_workout_user_routine_date,priority:2" json:"routineId"`
	Date        time.Time     `gorm:"type:date;not null;uniqueIndex:idx_workout_user_routine_date,priority:3" json:"date"`
	CompletedAt *time.Time    `json:"completedAt,omitempty"`
	Exercises   []ExerciseLog `gorm:"constraint:OnDelete:CASCADE" json:"exercises,omitempty"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

type ExerciseLog struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	WorkoutLogID      uint      `gorm:"not null;index" json:"workoutLogId"`
	RoutineExerciseID *uint     `json:"routineExerciseId,omitempty"`
	ExerciseID        *uint     `json:"exerciseId,omitempty"`
	ExerciseName      string    `gorm:"size:120;not null" json:"exerciseName"`
	SortOrder         int       `gorm:"not null;default:0" json:"sortOrder"`
	Sets              []Set     `gorm:"constraint:OnDelete:CASCADE" json:"sets,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

type Set struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ExerciseLogID uint      `gorm:"not null;uniqueIndex:idx_exercise_set_order,priority:1" json:"exerciseLogId"`
	SetNumber     int       `gorm:"not null;uniqueIndex:idx_exercise_set_order,priority:2" json:"setNumber"`
	Weight        float64   `gorm:"not null;default:0" json:"weight"`
	WeightUnit    string    `gorm:"size:8;not null;default:kg" json:"weightUnit"`
	Reps          int       `gorm:"not null" json:"reps"`
	CreatedAt     time.Time `json:"createdAt"`
}
