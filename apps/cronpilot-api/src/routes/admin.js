const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const { pool }   = require('../db');
const { executeJob } = require('../executor');

const router = Router();

// ── Users ──────────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at,
        COUNT(j.id)::int AS job_count
      FROM users u
      LEFT JOIN jobs j ON j.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  const { email, password, role = 'user' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  const { role, password } = req.body;
  if (role && !['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  // prevent removing the only admin
  if (role === 'user') {
    const { rows } = await pool.query("SELECT COUNT(*) FROM users WHERE role='admin' AND id != $1", [req.params.id]);
    if (parseInt(rows[0].count) === 0) return res.status(400).json({ error: 'Cannot demote the only admin' });
  }
  try {
    const updates = [];
    const params  = [];
    if (role) { params.push(role); updates.push(`role = $${params.length}`); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      params.push(hash); updates.push(`password_hash = $${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, email, role, created_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Jobs ───────────────────────────────────────────────────────────────────────

router.get('/jobs', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.*,
        u.email AS owner_email,
        (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id)::int AS execution_count,
        (SELECT status FROM executions e WHERE e.job_id = j.id ORDER BY started_at DESC LIMIT 1) AS last_execution_status
      FROM jobs j
      LEFT JOIN users u ON u.id = j.user_id
      ORDER BY j.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs', async (req, res) => {
  const { user_id, name, description, cron_expression, url,
          method = 'GET', headers = {}, body: reqBody,
          timezone = 'UTC', timeout_seconds = 30 } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO jobs (user_id, name, description, cron_expression, url, method, headers, body, timezone, timeout_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [user_id, name, description, cron_expression, url, method, JSON.stringify(headers), reqBody, timezone, timeout_seconds]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/jobs/:id', async (req, res) => {
  const { name, description, cron_expression, url, method = 'GET',
          headers = {}, body: reqBody, timezone = 'UTC', timeout_seconds = 30 } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE jobs SET name=$1, description=$2, cron_expression=$3, url=$4, method=$5,
       headers=$6, body=$7, timezone=$8, timeout_seconds=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, description, cron_expression, url, method, JSON.stringify(headers), reqBody, timezone, timeout_seconds, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Job not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/pause', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE jobs SET status='paused', updated_at=NOW() WHERE id=$1 AND status='active' RETURNING *",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not active' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/resume', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE jobs SET status='active', updated_at=NOW() WHERE id=$1 AND status='paused' RETURNING *",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not paused' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/trigger', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    executeJob(rows[0], 'manual');
    res.json({ message: 'Job triggered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
