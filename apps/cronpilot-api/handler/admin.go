package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"cronpilot-api/executor"
)

// ── Admin: Users ──────────────────────────────────────────────────────────────

func (h *Handler) AdminListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(context.Background(),
		`SELECT u.id::text, u.email, u.role, u.created_at, COUNT(j.id)::int
		 FROM users u LEFT JOIN jobs j ON j.user_id = u.id
		 GROUP BY u.id ORDER BY u.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt, &u.JobCount); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *Handler) AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := decode(r, &body); err != nil || body.Email == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "Email and password required")
		return
	}
	if body.Role == "" {
		body.Role = "user"
	}
	if body.Role != "user" && body.Role != "admin" {
		writeError(w, http.StatusBadRequest, "Invalid role")
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	var u User
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id::text, email, role, created_at`,
		body.Email, string(hash), body.Role,
	).Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "Email already registered")
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (h *Handler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Role     *string `json:"role"`
		Password *string `json:"password"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	id := chi.URLParam(r, "id")

	if body.Role != nil && *body.Role == "user" {
		var adminCount int
		h.db.QueryRow(context.Background(),
			"SELECT COUNT(*) FROM users WHERE role='admin' AND id != $1::uuid", id,
		).Scan(&adminCount)
		if adminCount == 0 {
			writeError(w, http.StatusBadRequest, "Cannot demote the only admin")
			return
		}
	}

	// build dynamic update
	sets := []string{}
	args := []any{}

	if body.Role != nil {
		args = append(args, *body.Role)
		sets = append(sets, "role = $"+itoa(len(args)))
	}
	if body.Password != nil && *body.Password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(*body.Password), 10)
		args = append(args, string(hash))
		sets = append(sets, "password_hash = $"+itoa(len(args)))
	}
	if len(sets) == 0 {
		writeError(w, http.StatusBadRequest, "Nothing to update")
		return
	}

	args = append(args, id)
	query := "UPDATE users SET " + joinComma(sets) + " WHERE id = $" + itoa(len(args)) + " RETURNING id::text, email, role, created_at"

	var u User
	if err := h.db.QueryRow(context.Background(), query, args...).Scan(&u.ID, &u.Email, &u.Role, &u.CreatedAt); err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *Handler) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == h.claims(r).UserID {
		writeError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}
	tag, err := h.db.Exec(context.Background(), "DELETE FROM users WHERE id = $1::uuid", id)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Admin: Jobs ───────────────────────────────────────────────────────────────

const adminJobsQuery = `
	SELECT j.id::text, j.user_id::text, j.name, COALESCE(j.description,''), j.cron_expression,
	       j.url, j.method, j.headers, j.body, j.status, j.timezone, j.timeout_seconds,
	       j.last_run_at, j.created_at, j.updated_at,
	       (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id)::int,
	       (SELECT status FROM executions e WHERE e.job_id = j.id ORDER BY started_at DESC LIMIT 1),
	       u.email
	FROM jobs j LEFT JOIN users u ON u.id = j.user_id`

func scanAdminJob(row interface{ Scan(...any) error }) (Job, error) {
	var j Job
	var rawHeaders []byte
	err := row.Scan(
		&j.ID, &j.UserID, &j.Name, &j.Description, &j.CronExpression,
		&j.URL, &j.Method, &rawHeaders, &j.Body, &j.Status, &j.Timezone, &j.TimeoutSeconds,
		&j.LastRunAt, &j.CreatedAt, &j.UpdatedAt,
		&j.ExecutionCount, &j.LastExecutionStatus, &j.OwnerEmail,
	)
	if len(rawHeaders) > 0 {
		j.Headers = rawHeaders
	} else {
		j.Headers = []byte(`{}`)
	}
	return j, err
}

func (h *Handler) AdminListJobs(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(context.Background(), adminJobsQuery+` ORDER BY j.created_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	jobs := []Job{}
	for rows.Next() {
		j, err := scanAdminJob(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jobs = append(jobs, j)
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *Handler) AdminCreateJob(w http.ResponseWriter, r *http.Request) {
	var b struct {
		jobInput
		UserID string `json:"user_id"`
	}
	if err := decode(r, &b); err != nil || b.UserID == "" {
		writeError(w, http.StatusBadRequest, "user_id required")
		return
	}
	b.applyDefaults()

	var id string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO jobs (user_id,name,description,cron_expression,url,method,headers,body,timezone,timeout_seconds)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text`,
		b.UserID, b.Name, b.Description, b.CronExpression, b.URL, b.Method,
		b.headersJSON(), b.Body, b.Timezone, b.TimeoutSeconds,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	j, _ := scanAdminJob(h.db.QueryRow(context.Background(), adminJobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusCreated, j)
}

func (h *Handler) AdminUpdateJob(w http.ResponseWriter, r *http.Request) {
	var b jobInput
	if err := decode(r, &b); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	b.applyDefaults()

	var id string
	err := h.db.QueryRow(context.Background(),
		`UPDATE jobs SET name=$1,description=$2,cron_expression=$3,url=$4,method=$5,
		 headers=$6,body=$7,timezone=$8,timeout_seconds=$9,updated_at=NOW()
		 WHERE id=$10::uuid RETURNING id::text`,
		b.Name, b.Description, b.CronExpression, b.URL, b.Method,
		b.headersJSON(), b.Body, b.Timezone, b.TimeoutSeconds,
		chi.URLParam(r, "id"),
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	j, _ := scanAdminJob(h.db.QueryRow(context.Background(), adminJobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusOK, j)
}

func (h *Handler) AdminDeleteJob(w http.ResponseWriter, r *http.Request) {
	tag, err := h.db.Exec(context.Background(), "DELETE FROM jobs WHERE id=$1::uuid", chi.URLParam(r, "id"))
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) AdminPauseJob(w http.ResponseWriter, r *http.Request) {
	h.adminSetJobStatus(w, r, "paused", "active")
}

func (h *Handler) AdminResumeJob(w http.ResponseWriter, r *http.Request) {
	h.adminSetJobStatus(w, r, "active", "paused")
}

func (h *Handler) adminSetJobStatus(w http.ResponseWriter, r *http.Request, newStatus, required string) {
	var id string
	err := h.db.QueryRow(context.Background(),
		`UPDATE jobs SET status=$1, updated_at=NOW() WHERE id=$2::uuid AND status=$3 RETURNING id::text`,
		newStatus, chi.URLParam(r, "id"), required,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found or wrong status")
		return
	}
	j, _ := scanAdminJob(h.db.QueryRow(context.Background(), adminJobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusOK, j)
}

func (h *Handler) AdminTriggerJob(w http.ResponseWriter, r *http.Request) {
	j, err := scanAdminJob(h.db.QueryRow(context.Background(),
		adminJobsQuery+` WHERE j.id = $1::uuid`, chi.URLParam(r, "id")))
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	executor.Run(h.db, toExecJob(j), "manual")
	writeJSON(w, http.StatusOK, map[string]string{"message": "Job triggered"})
}

// ── String helpers ────────────────────────────────────────────────────────────

func itoa(n int) string {
	return strconv.Itoa(n)
}

func joinComma(s []string) string {
	return strings.Join(s, ", ")
}
