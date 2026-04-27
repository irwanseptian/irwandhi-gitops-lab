const cron = require('node-cron');
const pool = require('./db');
const { executeJob } = require('./executor');

// Map<jobId, { task, scheduledAt }>
const tasks = new Map();

async function syncJobs() {
  const { rows: jobs } = await pool.query("SELECT * FROM jobs WHERE status = 'active'");
  const activeIds = new Set(jobs.map(j => j.id));

  // Stop tasks for jobs that are no longer active
  for (const [id, { task }] of tasks) {
    if (!activeIds.has(id)) {
      task.stop();
      tasks.delete(id);
      console.log(`Unscheduled job ${id}`);
    }
  }

  for (const job of jobs) {
    const existing   = tasks.get(job.id);
    const updatedAt  = new Date(job.updated_at).getTime();

    // Skip if already scheduled and not updated since
    if (existing && existing.scheduledAt >= updatedAt) continue;

    // Cancel stale task before rescheduling
    if (existing) {
      existing.task.stop();
      tasks.delete(job.id);
    }

    if (!cron.validate(job.cron_expression)) {
      console.warn(`[${job.name}] invalid cron expression: ${job.cron_expression}`);
      continue;
    }

    const task = cron.schedule(
      job.cron_expression,
      () => executeJob(job, 'schedule'),
      { timezone: job.timezone || 'UTC' }
    );

    tasks.set(job.id, { task, scheduledAt: Date.now() });
    console.log(`Scheduled [${job.name}] @ "${job.cron_expression}" (${job.timezone})`);
  }
}

async function start() {
  await syncJobs();
  // Re-sync every minute to pick up new/updated/deleted jobs
  cron.schedule('* * * * *', syncJobs);
  console.log('CronPilot Worker running');
}

module.exports = { start };
