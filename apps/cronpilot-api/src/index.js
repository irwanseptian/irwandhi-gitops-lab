const fs   = require('fs');
const path = require('path');
const app  = require('./app');
const { pool } = require('./db');

const PORT = process.env.PORT || 3000;

async function start() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
  await pool.query(schema);
  app.listen(PORT, () => console.log(`CronPilot API listening on :${PORT}`));
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
