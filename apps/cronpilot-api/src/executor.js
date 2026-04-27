const axios      = require('axios');
const { pool }   = require('./db');

async function executeJob(job, triggeredBy = 'manual') {
  const startedAt = new Date();
  let execId;

  try {
    const { rows } = await pool.query(
      `INSERT INTO executions (job_id, status, triggered_by, started_at)
       VALUES ($1, 'running', $2, $3) RETURNING id`,
      [job.id, triggeredBy, startedAt]
    );
    execId = rows[0].id;

    const resp = await axios({
      method:       job.method.toLowerCase(),
      url:          job.url,
      headers:      job.headers || {},
      data:         job.body || undefined,
      timeout:      (job.timeout_seconds || 30) * 1000,
      validateStatus: () => true,
    });

    const completedAt  = new Date();
    const durationMs   = completedAt - startedAt;
    const status       = resp.status < 400 ? 'success' : 'failure';
    const responseBody = String(
      typeof resp.data === 'object' ? JSON.stringify(resp.data) : resp.data ?? ''
    ).slice(0, 10000);

    await pool.query(
      `UPDATE executions
       SET status=$1, completed_at=$2, duration_ms=$3, response_status=$4, response_body=$5
       WHERE id=$6`,
      [status, completedAt, durationMs, resp.status, responseBody, execId]
    );
    await pool.query('UPDATE jobs SET last_run_at=$1 WHERE id=$2', [completedAt, job.id]);
    console.log(`[${job.name}] ${triggeredBy} → HTTP ${resp.status} in ${durationMs}ms`);
  } catch (err) {
    const completedAt = new Date();
    const errMsg = err.message || err.cause?.message || err.code || String(err);
    if (execId) {
      await pool.query(
        `UPDATE executions
         SET status='failure', completed_at=$1, duration_ms=$2, error_message=$3
         WHERE id=$4`,
        [completedAt, completedAt - startedAt, errMsg, execId]
      );
    }
    console.error(`[${job.name}] execution error:`, errMsg, err.code ? `(${err.code})` : '');
  }
}

module.exports = { executeJob };
