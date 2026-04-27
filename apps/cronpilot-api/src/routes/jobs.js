const { Router }  = require('express');
const { body, param, validationResult } = require('express-validator');
const { pool }    = require('../db');
const { executeJob } = require('../executor');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const jobFields = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('cron_expression').trim().notEmpty().withMessage('Cron expression is required'),
  body('url').isURL({ require_tld: false }).withMessage('Valid URL is required'),
  body('method').optional().isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  body('timeout_seconds').optional().isInt({ min: 1, max: 300 }),
];

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.*,
        (SELECT COUNT(*) FROM executions e WHERE e.job_id = j.id)::int AS execution_count,
        (SELECT status FROM executions e WHERE e.job_id = j.id ORDER BY started_at DESC LIMIT 1) AS last_execution_status
      FROM jobs j
      WHERE j.user_id = $1
      ORDER BY j.created_at DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', jobFields, validate, async (req, res) => {
  const { name, description, cron_expression, url, method = 'GET',
          headers = {}, body: reqBody, timezone = 'UTC', timeout_seconds = 30 } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO jobs (user_id, name, description, cron_expression, url, method, headers, body, timezone, timeout_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.userId, name, description, cron_expression, url, method, JSON.stringify(headers), reqBody, timezone, timeout_seconds]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', [param('id').isUUID(), ...jobFields], validate, async (req, res) => {
  const { name, description, cron_expression, url, method = 'GET',
          headers = {}, body: reqBody, timezone = 'UTC', timeout_seconds = 30 } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE jobs
       SET name=$1, description=$2, cron_expression=$3, url=$4, method=$5,
           headers=$6, body=$7, timezone=$8, timeout_seconds=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [name, description, cron_expression, url, method, JSON.stringify(headers), reqBody, timezone, timeout_seconds, req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM jobs WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Job not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/pause', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE jobs SET status='paused', updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='active' RETURNING *",
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not active' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resume', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE jobs SET status='active', updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='paused' RETURNING *",
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found or not paused' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/trigger', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    executeJob(rows[0], 'manual');
    res.json({ message: 'Job triggered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
