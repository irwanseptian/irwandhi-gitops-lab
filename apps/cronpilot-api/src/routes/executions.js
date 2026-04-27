const { Router } = require('express');
const { param, validationResult } = require('express-validator');
const { pool }   = require('../db');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', async (req, res) => {
  const { job_id, limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = '';
    if (job_id) {
      params.push(job_id);
      where = `WHERE e.job_id = $${params.length}`;
    }
    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(
      `SELECT e.*, j.name AS job_name
       FROM executions e JOIN jobs j ON e.job_id = j.id
       ${where}
       ORDER BY e.started_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', param('id').isUUID(), validate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, j.name AS job_name
       FROM executions e JOIN jobs j ON e.job_id = j.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Execution not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
