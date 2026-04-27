const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'cronpilot',
  user:     process.env.DB_USER     || 'cronpilot',
  password: process.env.DB_PASSWORD || 'cronpilot',
});

module.exports = { pool };
