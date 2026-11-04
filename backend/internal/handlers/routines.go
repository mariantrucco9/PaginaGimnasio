package handlers

import (
	"net/http"

	"workout-tracker/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListRoutines(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := c.Get("userID")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		var routines []models.Routine
		err := db.
			Preload("Exercises", func(query *gorm.DB) *gorm.DB {
				return query.Order("sort_order ASC")
			}).
			Preload("Exercises.Exercise").
			Where("user_id = ?", userID).
			Order("created_at ASC").
			Find(&routines).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load routines"})
			return
		}
		c.JSON(http.StatusOK, routines)
	}
}
