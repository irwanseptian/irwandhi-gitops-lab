const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES = '7d';

function log(event, data) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    log('register.failed', { reason: 'missing_fields' });
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (password.length < 6) {
    log('register.failed', { email, reason: 'password_too_short' });
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase().trim(), hash]
    );
    log('register.success', { email: rows[0].email, userId: rows[0].id });
    const token = jwt.sign({ userId: rows[0].id, email: rows[0].email, role: 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ token, user: { id: rows[0].id, email: rows[0].email, role: 'user' } });
  } catch (err) {
    if (err.code === '23505') {
      log('register.failed', { email, reason: 'email_already_registered' });
      return res.status(409).json({ error: 'Email already registered' });
    }
    log('register.error', { email, error: err.message });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    log('login.failed', { reason: 'missing_fields' });
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!rows.length) {
      log('login.failed', { email, reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      log('login.failed', { email, reason: 'wrong_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    log('login.success', { email: rows[0].email, userId: rows[0].id, role: rows[0].role });
    const token = jwt.sign({ userId: rows[0].id, email: rows[0].email, role: rows[0].role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, role: rows[0].role } });
  } catch (err) {
    log('login.error', { email, error: err.message });
    throw err;
  }
});

module.exports = router;
