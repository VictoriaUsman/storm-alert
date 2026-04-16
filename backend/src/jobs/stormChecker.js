const cron = require('node-cron');
const pool = require('../db');
const { fetchRecentStorms }   = require('../services/noaaService');
const { processStormAlerts }  = require('../services/alertService');

async function runStormCheck() {
  const daysBack = parseInt(process.env.DAYS_BACK) || 2;
  console.log(`[StormChecker] Starting check (${daysBack} days back)…`);

  let fetched = 0, created = 0, sent = 0;
  try {
    const storms = await fetchRecentStorms(daysBack);
    fetched = storms.length;

    for (const sd of storms) {
      const { rows: ex } = await pool.query(
        'SELECT id FROM storm_events WHERE noaa_id = $1', [sd.noaa_id]
      );
      if (ex.length) continue; // already processed

      const { rows: ins } = await pool.query(
        `INSERT INTO storm_events
           (event_date, event_type, severity, lat, lng, location_name, county, state,
            hail_size, wind_speed, description, noaa_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [sd.event_date, sd.event_type, sd.severity, sd.lat, sd.lng,
         sd.location_name, sd.county, sd.state, sd.hail_size, sd.wind_speed,
         sd.description, sd.noaa_id]
      );
      created++;

      const results = await processStormAlerts(ins[0]);
      sent += results.filter(r => r.status === 'sent').length;
    }

    console.log(`[StormChecker] Done — fetched: ${fetched}, new: ${created}, alerts sent: ${sent}`);
  } catch (err) {
    console.error('[StormChecker] Error:', err.message);
  }
}

function startStormChecker() {
  const expr = process.env.STORM_CHECK_CRON || '0 */6 * * *';

  if (!cron.validate(expr)) {
    console.error('[StormChecker] Invalid cron expression:', expr);
    return;
  }

  cron.schedule(expr, runStormCheck);
  console.log(`[StormChecker] Scheduled: "${expr}"`);

  // Run once ~5 s after startup so logs are clean
  setTimeout(runStormCheck, 5000);
}

module.exports = { startStormChecker, runStormCheck };
