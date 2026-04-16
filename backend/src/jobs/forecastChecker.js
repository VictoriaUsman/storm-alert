const cron = require('node-cron');
const pool = require('../db');
const { checkForecast }      = require('../services/tomorrowService');
const { processStormAlerts } = require('../services/alertService');

async function runForecastCheck() {
  if (!process.env.TOMORROW_API_KEY) return;

  // Get distinct zone locations for users who have alerts enabled
  const { rows: zones } = await pool.query(`
    SELECT DISTINCT ON (cz.center_lat, cz.center_lng)
      cz.center_lat, cz.center_lng
    FROM coverage_zones cz
    JOIN users u ON u.id = cz.user_id
    WHERE u.email_alerts = true
  `);

  if (!zones.length) return;

  let totalAlerts = 0;

  for (const zone of zones) {
    try {
      const forecasts = await checkForecast(
        parseFloat(zone.center_lat),
        parseFloat(zone.center_lng)
      );

      for (const f of forecasts) {
        // Insert forecast as a storm event — skip if already exists for today
        const { rows } = await pool.query(
          `INSERT INTO storm_events
             (event_date, event_type, severity, lat, lng,
              location_name, county, state, hail_size, wind_speed,
              description, source, noaa_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (noaa_id) DO NOTHING
           RETURNING *`,
          [
            f.event_date, f.event_type, f.severity, f.lat, f.lng,
            f.location_name, f.county, f.state, f.hail_size, f.wind_speed,
            f.description, f.source, f.noaa_id,
          ]
        );

        if (rows.length) {
          const results = await processStormAlerts(rows[0]);
          totalAlerts += results.filter(r => r.status === 'sent').length;
        }
      }
    } catch (err) {
      console.error(`[Forecast] Failed for ${zone.center_lat},${zone.center_lng}:`, err.message);
    }
  }

  console.log(`[Forecast] Done — checked ${zones.length} location(s), ${totalAlerts} alerts sent`);
}

function startForecastChecker() {
  if (!process.env.TOMORROW_API_KEY) {
    console.log('[Forecast] TOMORROW_API_KEY not set — forecast alerts disabled');
    return;
  }

  cron.schedule('0 * * * *', runForecastCheck); // every hour
  console.log('[Forecast] Scheduled: hourly');

  setTimeout(runForecastCheck, 8000); // run once ~8s after startup
}

module.exports = { startForecastChecker, runForecastCheck };
