package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"cronpilot-api/middleware"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	db     *pgxpool.Pool
	jwtKey []byte
}

func New(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtKey: []byte(jwtSecret)}
}

func (h *Handler) claims(r *http.Request) *middleware.Claims {
	return middleware.GetClaims(r)
}

// ── Response helpers ──────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// ── Shared model types ────────────────────────────────────────────────────────

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	JobCount  int       `json:"job_count,omitempty"`
}

type Job struct {
	ID                  string          `json:"id"`
	UserID              *string         `json:"user_id"`
	Name                string          `json:"name"`
	Description         string          `json:"description"`
	CronExpression      string          `json:"cron_expression"`
	URL                 string          `json:"url"`
	Method              string          `json:"method"`
	Headers             json.RawMessage `json:"headers"`
	Body                *string         `json:"body"`
	Status              string          `json:"status"`
	Timezone            string          `json:"timezone"`
	TimeoutSeconds      int             `json:"timeout_seconds"`
	ConcurrencyPolicy   string          `json:"concurrency_policy"`
	LastRunAt           *time.Time      `json:"last_run_at"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
	ExecutionCount      int             `json:"execution_count"`
	LastExecutionStatus *string         `json:"last_execution_status"`
	OwnerEmail          *string         `json:"owner_email,omitempty"`
}

type Execution struct {
	ID             string     `json:"id"`
	JobID          string     `json:"job_id"`
	JobName        string     `json:"job_name"`
	Status         string     `json:"status"`
	TriggeredBy    string     `json:"triggered_by"`
	StartedAt      time.Time  `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	DurationMs     *int       `json:"duration_ms"`
	ResponseStatus *int       `json:"response_status"`
	ResponseBody   *string    `json:"response_body"`
	ErrorMessage   *string    `json:"error_message"`
}
