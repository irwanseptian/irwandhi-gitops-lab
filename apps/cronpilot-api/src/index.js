const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const app    = require('./app');
const { pool } = require('./db');

const PORT = process.env.PORT || 3000;

async function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
  const statements = schema.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

async function seedAdmin() {
  const email    = process.env.ADMIN_EMAIL    || 'admin@cronpilot.com';
  const password = process.env.ADMIN_PASSWORD || 'Skills39';
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')",
      [email, hash]
    );
    console.log(`Admin user created: ${email}`);
  } else {
    // ensure the existing user has admin role
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1 AND role != 'admin'", [email]);
  }
}

async function start() {
  await runSchema();
  await seedAdmin();
  app.listen(PORT, () => console.log(`CronPilot API listening on :${PORT}`));
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
