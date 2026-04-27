const fs     = require('fs');
const path   = require('path');
const pool   = require('./db');
const { start } = require('./scheduler');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
}

init()
  .then(start)
  .catch(err => {
    console.error('Worker failed to start:', err);
    process.exit(1);
  });
