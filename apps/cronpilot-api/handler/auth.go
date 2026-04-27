package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"cronpilot-api/middleware"
)

const jwtExpiry = 7 * 24 * time.Hour

func authLog(event string, fields map[string]string) {
	data := map[string]string{"event": event}
	for k, v := range fields {
		data[k] = v
	}
	b, _ := json.Marshal(data)
	log.Println(string(b))
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		authLog("register.failed", map[string]string{"reason": "missing_fields"})
		writeError(w, http.StatusBadRequest, "Email and password required")
		return
	}
	if len(body.Password) < 6 {
		authLog("register.failed", map[string]string{"email": email, "reason": "password_too_short"})
		writeError(w, http.StatusBadRequest, "Password must be at least 6 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	var id, createdEmail string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id::text, email`,
		email, string(hash),
	).Scan(&id, &createdEmail)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			authLog("register.failed", map[string]string{"email": email, "reason": "email_already_registered"})
			writeError(w, http.StatusConflict, "Email already registered")
			return
		}
		authLog("register.error", map[string]string{"email": email, "error": err.Error()})
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	authLog("register.success", map[string]string{"email": createdEmail, "userId": id})
	token, _ := h.signToken(id, createdEmail, "user")
	writeJSON(w, http.StatusCreated, map[string]any{
		"token": token,
		"user":  map[string]string{"id": id, "email": createdEmail, "role": "user"},
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		authLog("login.failed", map[string]string{"reason": "missing_fields"})
		writeError(w, http.StatusBadRequest, "Email and password required")
		return
	}

	var id, dbEmail, passwordHash, role string
	err := h.db.QueryRow(context.Background(),
		`SELECT id::text, email, password_hash, role FROM users WHERE email = $1`, email,
	).Scan(&id, &dbEmail, &passwordHash, &role)
	if err != nil {
		authLog("login.failed", map[string]string{"email": email, "reason": "user_not_found"})
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		authLog("login.failed", map[string]string{"email": email, "reason": "wrong_password"})
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	authLog("login.success", map[string]string{"email": dbEmail, "userId": id, "role": role})
	token, _ := h.signToken(id, dbEmail, role)
	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user":  map[string]string{"id": id, "email": dbEmail, "role": role},
	})
}

func (h *Handler) signToken(userID, email, role string) (string, error) {
	claims := middleware.Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(h.jwtKey)
}
