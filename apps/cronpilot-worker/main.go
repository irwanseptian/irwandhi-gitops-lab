package main

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"

	"cronpilot-worker/scheduler"
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

	s := scheduler.New(pool)
	s.Start()

	// Block until SIGINT/SIGTERM.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("CronPilot Worker shutting down")
}

func runSchema(ctx context.Context, pool *pgxpool.Pool) error {
	for _, stmt := range splitSQL(schema) {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("stmt %.60q: %w", stmt, err)
		}
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
