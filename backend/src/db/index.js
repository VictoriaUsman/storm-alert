const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects,
// so frontend code can safely concatenate 'T12:00:00Z' without getting Invalid Date.
types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

module.exports = pool;
