package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"workout-tracker/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var sixDigitPIN = regexp.MustCompile(`^[0-9]{6}$`)

type loginRequest struct {
	PIN string `json:"pin" binding:"required"`
}

func Login(db *gorm.DB, pinSecret, jwtSecret []byte, ttlHours int) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request loginRequest
		if err := c.ShouldBindJSON(&request); err != nil || !sixDigitPIN.MatchString(request.PIN) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "PIN must contain exactly 6 digits"})
			return
		}

		digest := pinDigest(request.PIN, pinSecret)
		var user models.User
		if err := db.Where("pin_digest = ?", digest).First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid PIN"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not validate PIN"})
			return
		}

		now := time.Now()
		claims := jwt.RegisteredClaims{
			Subject:   uintToString(user.ID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(ttlHours) * time.Hour)),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString(jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create access token"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token": signedToken,
			"user":  gin.H{"id": user.ID, "name": user.Name},
		})
	}
}

func pinDigest(pin string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(pin))
	return hex.EncodeToString(mac.Sum(nil))
}

func uintToString(value uint) string {
	return strconv.FormatUint(uint64(value), 10)
}
