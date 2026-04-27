package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"cronpilot-api/executor"
)

const jobsQuery = `
	SELECT j.id::text, j.user_id::text, j.name, COALESCE(j.description,''), j.cron_expression,
	       j.url, j.method, j.headers, j.body, j.status, j.timezone, j.timeout_seconds,
	       j.last_run_at, j.created_at, j.updated_at,
	       (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id)::int,
	       (SELECT status FROM executions e WHERE e.job_id = j.id ORDER BY started_at DESC LIMIT 1)
	FROM jobs j`

func scanJob(row interface {
	Scan(...any) error
}) (Job, error) {
	var j Job
	var rawHeaders []byte
	err := row.Scan(
		&j.ID, &j.UserID, &j.Name, &j.Description, &j.CronExpression,
		&j.URL, &j.Method, &rawHeaders, &j.Body, &j.Status, &j.Timezone, &j.TimeoutSeconds,
		&j.LastRunAt, &j.CreatedAt, &j.UpdatedAt,
		&j.ExecutionCount, &j.LastExecutionStatus,
	)
	if len(rawHeaders) > 0 {
		j.Headers = json.RawMessage(rawHeaders)
	} else {
		j.Headers = json.RawMessage(`{}`)
	}
	return j, err
}

func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	rows, err := h.db.Query(context.Background(),
		jobsQuery+` WHERE j.user_id = $1 ORDER BY j.created_at DESC`, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	jobs := []Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jobs = append(jobs, j)
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	j, err := scanJob(h.db.QueryRow(context.Background(),
		jobsQuery+` WHERE j.id = $1::uuid AND j.user_id = $2::uuid`,
		chi.URLParam(r, "id"), uid))
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	writeJSON(w, http.StatusOK, j)
}

func (h *Handler) CreateJob(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	var b jobInput
	if err := decode(r, &b); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	b.applyDefaults()

	var id string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO jobs (user_id,name,description,cron_expression,url,method,headers,body,timezone,timeout_seconds)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text`,
		uid, b.Name, b.Description, b.CronExpression, b.URL, b.Method,
		b.headersJSON(), b.Body, b.Timezone, b.TimeoutSeconds,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	j, _ := scanJob(h.db.QueryRow(context.Background(), jobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusCreated, j)
}

func (h *Handler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
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
		 WHERE id=$10::uuid AND user_id=$11::uuid RETURNING id::text`,
		b.Name, b.Description, b.CronExpression, b.URL, b.Method,
		b.headersJSON(), b.Body, b.Timezone, b.TimeoutSeconds,
		chi.URLParam(r, "id"), uid,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	j, _ := scanJob(h.db.QueryRow(context.Background(), jobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusOK, j)
}

func (h *Handler) DeleteJob(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	tag, err := h.db.Exec(context.Background(),
		`DELETE FROM jobs WHERE id=$1::uuid AND user_id=$2::uuid`,
		chi.URLParam(r, "id"), uid)
	if err != nil || tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) PauseJob(w http.ResponseWriter, r *http.Request) {
	h.setJobStatus(w, r, "paused", "active")
}

func (h *Handler) ResumeJob(w http.ResponseWriter, r *http.Request) {
	h.setJobStatus(w, r, "active", "paused")
}

func (h *Handler) setJobStatus(w http.ResponseWriter, r *http.Request, newStatus, requiredStatus string) {
	uid := h.claims(r).UserID
	var id string
	err := h.db.QueryRow(context.Background(),
		`UPDATE jobs SET status=$1, updated_at=NOW()
		 WHERE id=$2::uuid AND user_id=$3::uuid AND status=$4 RETURNING id::text`,
		newStatus, chi.URLParam(r, "id"), uid, requiredStatus,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found or wrong status")
		return
	}
	j, _ := scanJob(h.db.QueryRow(context.Background(), jobsQuery+` WHERE j.id = $1::uuid`, id))
	writeJSON(w, http.StatusOK, j)
}

func (h *Handler) TriggerJob(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	j, err := scanJob(h.db.QueryRow(context.Background(),
		jobsQuery+` WHERE j.id = $1::uuid AND j.user_id = $2::uuid`,
		chi.URLParam(r, "id"), uid))
	if err != nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	executor.Run(h.db, toExecJob(j), "manual")
	writeJSON(w, http.StatusOK, map[string]string{"message": "Job triggered"})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type jobInput struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	CronExpression string          `json:"cron_expression"`
	URL            string          `json:"url"`
	Method         string          `json:"method"`
	Headers        json.RawMessage `json:"headers"`
	Body           *string         `json:"body"`
	Timezone       string          `json:"timezone"`
	TimeoutSeconds int             `json:"timeout_seconds"`
}

func (b *jobInput) applyDefaults() {
	if b.Method == "" {
		b.Method = "GET"
	}
	if b.Timezone == "" {
		b.Timezone = "UTC"
	}
	if b.TimeoutSeconds == 0 {
		b.TimeoutSeconds = 30
	}
}

func (b *jobInput) headersJSON() string {
	if len(b.Headers) == 0 {
		return "{}"
	}
	return string(b.Headers)
}

func toExecJob(j Job) executor.Job {
	return executor.Job{
		ID:             j.ID,
		Name:           j.Name,
		URL:            j.URL,
		Method:         j.Method,
		Headers:        j.Headers,
		Body:           j.Body,
		TimeoutSeconds: j.TimeoutSeconds,
	}
}
