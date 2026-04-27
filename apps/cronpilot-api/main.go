package main

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"cronpilot-api/handler"
	"cronpilot-api/middleware"
)

//go:embed db/schema.sql
var schema string

func main() {
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dsn())
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := runSchema(ctx, pool); err != nil {
		log.Fatalf("schema: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		log.Fatalf("seed admin: %v", err)
	}

	jwtSecret := getenv("JWT_SECRET", "changeme")
	h := handler.New(pool, jwtSecret)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{getenv("CORS_ORIGIN", "*")},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
	}))

	authMw := middleware.RequireAuth(jwtSecret)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)
		r.Post("/auth/register", h.Register)
		r.Post("/auth/login", h.Login)

		r.Group(func(r chi.Router) {
			r.Use(authMw)

			r.Get("/jobs", h.ListJobs)
			r.Post("/jobs", h.CreateJob)
			r.Get("/jobs/{id}", h.GetJob)
			r.Put("/jobs/{id}", h.UpdateJob)
			r.Delete("/jobs/{id}", h.DeleteJob)
			r.Post("/jobs/{id}/pause", h.PauseJob)
			r.Post("/jobs/{id}/resume", h.ResumeJob)
			r.Post("/jobs/{id}/trigger", h.TriggerJob)

			r.Put("/profile/password", h.ChangePassword)

			r.Get("/report/summary",        h.ReportSummary)
			r.Get("/report/timeline",       h.ReportTimeline)
			r.Get("/report/jobs",           h.ReportJobs)
			r.Get("/report/executions.csv", h.ReportCSV)

			r.Get("/executions", h.ListExecutions)
			r.Get("/executions/{id}", h.GetExecution)

			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAdmin)

				r.Get("/admin/users", h.AdminListUsers)
				r.Post("/admin/users", h.AdminCreateUser)
				r.Patch("/admin/users/{id}", h.AdminUpdateUser)
				r.Delete("/admin/users/{id}", h.AdminDeleteUser)

				r.Get("/admin/jobs", h.AdminListJobs)
				r.Post("/admin/jobs", h.AdminCreateJob)
				r.Put("/admin/jobs/{id}", h.AdminUpdateJob)
				r.Delete("/admin/jobs/{id}", h.AdminDeleteJob)
				r.Post("/admin/jobs/{id}/pause", h.AdminPauseJob)
				r.Post("/admin/jobs/{id}/resume", h.AdminResumeJob)
				r.Post("/admin/jobs/{id}/trigger", h.AdminTriggerJob)
			})
		})
	})

	port := getenv("PORT", "3000")
	log.Printf("CronPilot API (Go) listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func runSchema(ctx context.Context, pool *pgxpool.Pool) error {
	for _, stmt := range splitSQL(schema) {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("stmt %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

func seedAdmin(ctx context.Context, pool *pgxpool.Pool) error {
	email := getenv("ADMIN_EMAIL", "admin@cronpilot.com")
	pass := getenv("ADMIN_PASSWORD", "Skills39")

	var count int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email=$1", email).Scan(&count)
	if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(pass), 10)
		if err != nil {
			return err
		}
		_, err = pool.Exec(ctx,
			"INSERT INTO users (email, password_hash, role) VALUES ($1,$2,'admin')", email, string(hash))
		if err != nil {
			return err
		}
		log.Printf("Admin user created: %s", email)
	} else {
		pool.Exec(ctx, "UPDATE users SET role='admin' WHERE email=$1 AND role!='admin'", email)
	}
	return nil
}

func splitSQL(s string) []string {
	var stmts []string
	for _, part := range strings.Split(s, ";\n") {
		if t := strings.TrimSpace(part); t != "" {
			stmts = append(stmts, t)
		}
	}
	return stmts
}

func dsn() string {
	return fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		getenv("DB_HOST", "localhost"),
		getenv("DB_PORT", "5432"),
		getenv("DB_NAME", "cronpilot"),
		getenv("DB_USER", "cronpilot"),
		getenv("DB_PASSWORD", "cronpilot"),
	)
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
