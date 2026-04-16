// Run with: npm run db:setup
// Requires DATABASE_URL to be set in .env
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function setup() {
  const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // pg won't run multi-statement strings reliably — split and execute one by one.
  // Strip comment lines from each chunk first, otherwise blocks that open with
  // a "-- ─── Section ───" comment get dropped entirely.
  const statements = schema
    .split(';')
    .map(s =>
      s.split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(s => s.length > 0);

  const client = await pool.connect();
  let failed = false;
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        // Log the failing statement so we can see exactly what broke
        const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
        console.error(`✗ Statement failed: "${preview}…"`);
        console.error(`  Error: ${err.message}`);
        failed = true;
        break;
      }
    }
    if (!failed) console.log('✓ Database schema created successfully');
  } finally {
    client.release();
    await pool.end();
  }
  if (failed) process.exit(1);
}

setup();
