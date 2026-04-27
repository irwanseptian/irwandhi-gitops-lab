package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// ── Summary ───────────────────────────────────────────────────────────────────

type reportSummary struct {
	TotalJobs      int     `json:"total_jobs"`
	ActiveJobs     int     `json:"active_jobs"`
	PausedJobs     int     `json:"paused_jobs"`
	TotalExec      int     `json:"total_executions"`
	SuccessCount   int     `json:"success_count"`
	FailureCount   int     `json:"failure_count"`
	RunningCount   int     `json:"running_count"`
	SuccessRate    float64 `json:"success_rate"`
	AvgDurationMs  float64 `json:"avg_duration_ms"`
}

func (h *Handler) ReportSummary(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	ctx := context.Background()

	var s reportSummary

	h.db.QueryRow(ctx,
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE status='active'),
		        COUNT(*) FILTER (WHERE status='paused')
		 FROM jobs WHERE user_id=$1::uuid`, uid,
	).Scan(&s.TotalJobs, &s.ActiveJobs, &s.PausedJobs)

	h.db.QueryRow(ctx,
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE e.status='success'),
		        COUNT(*) FILTER (WHERE e.status='failure'),
		        COUNT(*) FILTER (WHERE e.status='running'),
		        COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0)
		 FROM executions e
		 JOIN jobs j ON e.job_id = j.id
		 WHERE j.user_id = $1::uuid`, uid,
	).Scan(&s.TotalExec, &s.SuccessCount, &s.FailureCount, &s.RunningCount, &s.AvgDurationMs)

	completed := s.SuccessCount + s.FailureCount
	if completed > 0 {
		s.SuccessRate = float64(s.SuccessCount) / float64(completed) * 100
	}

	writeJSON(w, http.StatusOK, s)
}

// ── Timeline ─────────────────────────────────────────────────────────────────

type timelinePoint struct {
	Date    string `json:"date"`
	Success int    `json:"success"`
	Failure int    `json:"failure"`
	Total   int    `json:"total"`
}

func (h *Handler) ReportTimeline(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 90 {
		days = 30
	}
	ctx := context.Background()

	rows, err := h.db.Query(ctx,
		`SELECT DATE(e.started_at) AS day,
		        COUNT(*) FILTER (WHERE e.status='success')::int,
		        COUNT(*) FILTER (WHERE e.status='failure')::int,
		        COUNT(*)::int
		 FROM executions e
		 JOIN jobs j ON e.job_id = j.id
		 WHERE j.user_id = $1::uuid
		   AND e.started_at >= NOW() - ($2 || ' days')::interval
		 GROUP BY day
		 ORDER BY day ASC`, uid, strconv.Itoa(days),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	// Build a dense series so missing days appear as zeros.
	byDate := map[string]timelinePoint{}
	for rows.Next() {
		var p timelinePoint
		var d time.Time
		if err := rows.Scan(&d, &p.Success, &p.Failure, &p.Total); err != nil {
			continue
		}
		p.Date = d.Format("2006-01-02")
		byDate[p.Date] = p
	}

	points := make([]timelinePoint, days)
	for i := 0; i < days; i++ {
		date := time.Now().UTC().AddDate(0, 0, -(days-1-i)).Format("2006-01-02")
		if p, ok := byDate[date]; ok {
			points[i] = p
		} else {
			points[i] = timelinePoint{Date: date}
		}
	}
	writeJSON(w, http.StatusOK, points)
}

// ── Per-job stats ─────────────────────────────────────────────────────────────

type jobReportRow struct {
	JobID         string     `json:"job_id"`
	JobName       string     `json:"job_name"`
	Status        string     `json:"status"`
	CronExpr      string     `json:"cron_expression"`
	TotalExec     int        `json:"total_executions"`
	SuccessCount  int        `json:"success_count"`
	FailureCount  int        `json:"failure_count"`
	SuccessRate   float64    `json:"success_rate"`
	AvgDurationMs float64    `json:"avg_duration_ms"`
	LastRunAt     *time.Time `json:"last_run_at"`
}

func (h *Handler) ReportJobs(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	ctx := context.Background()

	rows, err := h.db.Query(ctx,
		`SELECT j.id::text, j.name, j.status, j.cron_expression,
		        COUNT(e.id)::int,
		        COUNT(e.id) FILTER (WHERE e.status='success')::int,
		        COUNT(e.id) FILTER (WHERE e.status='failure')::int,
		        COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0),
		        j.last_run_at
		 FROM jobs j
		 LEFT JOIN executions e ON e.job_id = j.id
		 WHERE j.user_id = $1::uuid
		 GROUP BY j.id
		 ORDER BY j.created_at DESC`, uid,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	result := []jobReportRow{}
	for rows.Next() {
		var row jobReportRow
		if err := rows.Scan(
			&row.JobID, &row.JobName, &row.Status, &row.CronExpr,
			&row.TotalExec, &row.SuccessCount, &row.FailureCount,
			&row.AvgDurationMs, &row.LastRunAt,
		); err != nil {
			continue
		}
		completed := row.SuccessCount + row.FailureCount
		if completed > 0 {
			row.SuccessRate = float64(row.SuccessCount) / float64(completed) * 100
		}
		result = append(result, row)
	}
	writeJSON(w, http.StatusOK, result)
}

// ── CSV export ────────────────────────────────────────────────────────────────

func (h *Handler) ReportCSV(w http.ResponseWriter, r *http.Request) {
	uid := h.claims(r).UserID
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 {
		days = 30
	}
	jobID := r.URL.Query().Get("job_id")
	ctx := context.Background()

	query := `SELECT e.id::text, j.name, e.status, e.triggered_by,
	                 e.started_at, COALESCE(e.completed_at::text,''),
	                 COALESCE(e.duration_ms::text,''), COALESCE(e.response_status::text,''),
	                 COALESCE(e.error_message,'')
	          FROM executions e
	          JOIN jobs j ON e.job_id = j.id
	          WHERE j.user_id = $1::uuid
	            AND e.started_at >= NOW() - ($2 || ' days')::interval`
	args := []any{uid, strconv.Itoa(days)}

	if jobID != "" {
		query += ` AND e.job_id = $3::uuid`
		args = append(args, jobID)
	}
	query += ` ORDER BY e.started_at DESC`

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="executions-%s.csv"`, time.Now().Format("2006-01-02")))

	fmt.Fprintln(w, "execution_id,job_name,status,triggered_by,started_at,completed_at,duration_ms,response_status,error_message")

	for rows.Next() {
		var (
			id, jobName, status, triggeredBy string
			startedAt                        time.Time
			completedAt, durationMs, respStatus, errMsg string
		)
		if err := rows.Scan(&id, &jobName, &status, &triggeredBy,
			&startedAt, &completedAt, &durationMs, &respStatus, &errMsg); err != nil {
			continue
		}
		fmt.Fprintf(w, "%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
			csvEsc(id), csvEsc(jobName), status, triggeredBy,
			startedAt.Format(time.RFC3339),
			csvEsc(completedAt), csvEsc(durationMs), csvEsc(respStatus), csvEsc(errMsg),
		)
	}
}

func csvEsc(s string) string {
	if s == "" {
		return ""
	}
	for _, c := range s {
		if c == ',' || c == '"' || c == '\n' || c == '\r' {
			return `"` + s + `"`
		}
	}
	return s
}
