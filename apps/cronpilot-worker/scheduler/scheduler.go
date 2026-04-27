package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"

	"cronpilot-worker/executor"
)

type entry struct {
	cronID      cron.EntryID
	scheduledAt time.Time // tracks job.updated_at so we can detect changes
}

type Scheduler struct {
	c       *cron.Cron
	db      *pgxpool.Pool
	entries map[string]entry
	mu      sync.Mutex
}

func New(db *pgxpool.Pool) *Scheduler {
	return &Scheduler{
		// Use standard 5-field cron (minute granularity), matching node-cron behaviour.
		// CRON_TZ= prefix in expressions is handled by robfig/cron automatically.
		c: cron.New(cron.WithParser(cron.NewParser(
			cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
		))),
		db:      db,
		entries: make(map[string]entry),
	}
}

// Start performs an initial sync then re-syncs every minute in the background.
func (s *Scheduler) Start() {
	s.c.Start()
	s.sync()
	log.Println("CronPilot Worker (Go) running")

	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			s.sync()
		}
	}()
}

// sync queries the DB for active jobs and reconciles the scheduled entries.
func (s *Scheduler) sync() {
	ctx := context.Background()

	rows, err := s.db.Query(ctx, `
		SELECT id::text, name, cron_expression, COALESCE(timezone,'UTC'),
		       url, method, headers, body, timeout_seconds, updated_at
		FROM jobs WHERE status = 'active'`)
	if err != nil {
		log.Printf("scheduler sync query error: %v", err)
		return
	}
	defer rows.Close()

	type dbJob struct {
		executor.Job
		cronExpr  string
		timezone  string
		updatedAt time.Time
	}

	var jobs []dbJob
	for rows.Next() {
		var j dbJob
		var rawHeaders []byte
		if err := rows.Scan(
			&j.ID, &j.Name, &j.cronExpr, &j.timezone,
			&j.URL, &j.Method, &rawHeaders, &j.Body, &j.TimeoutSeconds, &j.updatedAt,
		); err != nil {
			log.Printf("scheduler scan error: %v", err)
			continue
		}
		if len(rawHeaders) > 0 {
			j.Headers = json.RawMessage(rawHeaders)
		}
		jobs = append(jobs, j)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Build set of active IDs for fast lookup.
	activeIDs := make(map[string]struct{}, len(jobs))
	for _, j := range jobs {
		activeIDs[j.ID] = struct{}{}
	}

	// Remove entries that are no longer active.
	for id, e := range s.entries {
		if _, ok := activeIDs[id]; !ok {
			s.c.Remove(e.cronID)
			delete(s.entries, id)
			log.Printf("Unscheduled job %s", id)
		}
	}

	// Add new jobs or reschedule updated ones.
	for _, j := range jobs {
		j := j

		existing, scheduled := s.entries[j.ID]
		if scheduled && !existing.scheduledAt.Before(j.updatedAt) {
			// already up-to-date
			continue
		}

		// Remove stale entry before rescheduling.
		if scheduled {
			s.c.Remove(existing.cronID)
			delete(s.entries, j.ID)
		}

		// Prepend timezone so robfig/cron respects it per-entry.
		expr := fmt.Sprintf("CRON_TZ=%s %s", j.timezone, j.cronExpr)

		id, err := s.c.AddFunc(expr, func() {
			executor.Run(s.db, j.Job, "schedule")
		})
		if err != nil {
			log.Printf("[%s] failed to schedule %q: %v", j.Name, expr, err)
			continue
		}

		s.entries[j.ID] = entry{cronID: id, scheduledAt: time.Now()}
		log.Printf(`Scheduled [%s] @ %q (%s)`, j.Name, j.cronExpr, j.timezone)
	}
}
