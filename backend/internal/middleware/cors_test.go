package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsConfiguredOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://preview.example.com ")

	router := gin.New()
	router.Use(CORS())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set("Origin", "https://preview.example.com")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://preview.example.com" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want configured origin", got)
	}
}

func TestCORSDefaultsToLocalViteOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	router := gin.New()
	router.Use(CORS())
	router.OPTIONS("/", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodOptions, "/", nil)
	request.Header.Set("Origin", "http://localhost:5173")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want local Vite origin", got)
	}
	if got := response.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, PUT, DELETE, OPTIONS" {
		t.Fatalf("Access-Control-Allow-Methods = %q, want methods used by API", got)
	}
}
