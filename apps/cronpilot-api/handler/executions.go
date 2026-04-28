package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) ListExecutions(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	jobID := r.URL.Query().Get("job_id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 {
		limit = 50
	}

	var (
		rows interface{ Next() bool; Scan(...any) error; Close() }
		err  error
	)
	if jobID != "" {
		rows, err = h.db.Query(context.Background(),
			`SELECT e.id::text, e.job_id::text, j.name, e.status, e.triggered_by,
			        e.started_at, e.completed_at, e.duration_ms, e.response_status,
			        e.response_body, e.error_message
			 FROM executions e JOIN jobs j ON e.job_id = j.id
			 WHERE j.user_id = $1::uuid AND e.job_id = $2::uuid
			 ORDER BY e.started_at DESC LIMIT $3 OFFSET $4`,
			uid, jobID, limit, offset)
	} else {
		rows, err = h.db.Query(context.Background(),
			`SELECT e.id::text, e.job_id::text, j.name, e.status, e.triggered_by,
			        e.started_at, e.completed_at, e.duration_ms, e.response_status,
			        e.response_body, e.error_message
			 FROM executions e JOIN jobs j ON e.job_id = j.id
			 WHERE j.user_id = $1::uuid
			 ORDER BY e.started_at DESC LIMIT $2 OFFSET $3`,
			uid, limit, offset)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	execs := []Execution{}
	for rows.Next() {
		var e Execution
		if err := rows.Scan(&e.ID, &e.JobID, &e.JobName, &e.Status, &e.TriggeredBy,
			&e.StartedAt, &e.CompletedAt, &e.DurationMs, &e.ResponseStatus,
			&e.ResponseBody, &e.ErrorMessage); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		execs = append(execs, e)
	}
	writeJSON(w, http.StatusOK, execs)
}

func (h *Handler) ListRunningExecutions(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	rows, err := h.db.Query(context.Background(),
		`SELECT e.id::text, e.job_id::text, j.name, e.status, e.triggered_by,
		        e.started_at, e.completed_at, e.duration_ms, e.response_status,
		        e.response_body, e.error_message
		 FROM executions e JOIN jobs j ON e.job_id = j.id
		 WHERE j.user_id = $1::uuid AND e.status = 'running'
		 ORDER BY e.started_at ASC`, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	execs := []Execution{}
	for rows.Next() {
		var e Execution
		if err := rows.Scan(&e.ID, &e.JobID, &e.JobName, &e.Status, &e.TriggeredBy,
			&e.StartedAt, &e.CompletedAt, &e.DurationMs, &e.ResponseStatus,
			&e.ResponseBody, &e.ErrorMessage); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		execs = append(execs, e)
	}
	writeJSON(w, http.StatusOK, execs)
}

func (h *Handler) GetExecution(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	var e Execution
	err := h.db.QueryRow(context.Background(),
		`SELECT e.id::text, e.job_id::text, j.name, e.status, e.triggered_by,
		        e.started_at, e.completed_at, e.duration_ms, e.response_status,
		        e.response_body, e.error_message
		 FROM executions e JOIN jobs j ON e.job_id = j.id
		 WHERE e.id = $1::uuid AND j.user_id = $2::uuid`,
		chi.URLParam(r, "id"), uid,
	).Scan(&e.ID, &e.JobID, &e.JobName, &e.Status, &e.TriggeredBy,
		&e.StartedAt, &e.CompletedAt, &e.DurationMs, &e.ResponseStatus,
		&e.ResponseBody, &e.ErrorMessage)
	if err != nil {
		writeError(w, http.StatusNotFound, "Execution not found")
		return
	}
	writeJSON(w, http.StatusOK, e)
}
