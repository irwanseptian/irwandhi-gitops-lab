package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Job struct {
	ID             string
	Name           string
	URL            string
	Method         string
	Headers        json.RawMessage
	Body           *string
	TimeoutSeconds int
}

func Run(db *pgxpool.Pool, job Job, triggeredBy string) {
	go run(db, job, triggeredBy)
}

func run(db *pgxpool.Pool, job Job, triggeredBy string) {
	ctx := context.Background()
	startedAt := time.Now()

	var execID string
	err := db.QueryRow(ctx,
		`INSERT INTO executions (job_id, status, triggered_by, started_at)
		 VALUES ($1, 'running', $2, $3) RETURNING id::text`,
		job.ID, triggeredBy, startedAt,
	).Scan(&execID)
	if err != nil {
		log.Printf("[%s] failed to create execution record: %v", job.Name, err)
		return
	}

	status, httpStatus, respBody, execErr := doRequest(job)

	completedAt := time.Now()
	durationMs := int(completedAt.Sub(startedAt).Milliseconds())

	if execErr != nil {
		errMsg := execErr.Error()
		db.Exec(ctx,
			`UPDATE executions SET status='failure', completed_at=$1, duration_ms=$2, error_message=$3 WHERE id=$4`,
			completedAt, durationMs, errMsg, execID,
		)
		log.Printf("[%s] %s error: %v", job.Name, triggeredBy, execErr)
		return
	}

	db.Exec(ctx,
		`UPDATE executions SET status=$1, completed_at=$2, duration_ms=$3, response_status=$4, response_body=$5 WHERE id=$6`,
		status, completedAt, durationMs, httpStatus, respBody, execID,
	)
	db.Exec(ctx, `UPDATE jobs SET last_run_at=$1 WHERE id=$2`, completedAt, job.ID)
	log.Printf("[%s] %s → HTTP %d in %dms", job.Name, triggeredBy, httpStatus, durationMs)
}

func doRequest(job Job) (status string, httpStatus int, respBody string, err error) {
	timeout := time.Duration(job.TimeoutSeconds) * time.Second
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	var bodyReader io.Reader
	if job.Body != nil && *job.Body != "" {
		bodyReader = strings.NewReader(*job.Body)
	}

	req, err := http.NewRequest(strings.ToUpper(job.Method), job.URL, bodyReader)
	if err != nil {
		return "", 0, "", fmt.Errorf("build request: %w", err)
	}

	if len(job.Headers) > 0 {
		var headers map[string]string
		if json.Unmarshal(job.Headers, &headers) == nil {
			for k, v := range headers {
				req.Header.Set(k, v)
			}
		}
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 10_000))
	respBody = string(raw)
	httpStatus = resp.StatusCode
	if httpStatus < 400 {
		status = "success"
	} else {
		status = "failure"
	}
	return
}
