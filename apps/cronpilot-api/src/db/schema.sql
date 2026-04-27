CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS jobs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         REFERENCES users(id) ON DELETE CASCADE,
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

-- migrate existing DBs that already have the jobs table without user_id
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

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
CREATE INDEX IF NOT EXISTS idx_jobs_user_id         ON jobs(user_id);
