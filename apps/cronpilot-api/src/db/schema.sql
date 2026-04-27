CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS jobs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  cron_expression  VARCHAR(100) NOT NULL,
  url              VARCHAR(2048) NOT NULL,
  method           VARCHAR(10)  NOT NULL DEFAULT 'GET',
  headers          JSONB        DEFAULT '{}',
  body             TEXT,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active',
  timezone         VARCHAR(100) DEFAULT 'UTC',
  timeout_seconds  INT          DEFAULT 30,
  last_run_at      TIMESTAMP,
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  triggered_by    VARCHAR(20) DEFAULT 'schedule',
  started_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP,
  duration_ms     INT,
  response_status INT,
  response_body   TEXT,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_job_id    ON executions(job_id);
CREATE INDEX IF NOT EXISTS idx_executions_started   ON executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status          ON jobs(status);
