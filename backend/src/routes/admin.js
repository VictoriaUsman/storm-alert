const express = require('express');
const pool    = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendManualAlert, processStormAlerts } = require('../services/alertService');
const { fetchRecentStorms } = require('../services/noaaService');
const { runForecastCheck } = require('../jobs/forecastChecker');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/clients
router.get('/clients', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      u.id, u.email, u.company_name, u.contact_name, u.phone,
      u.email_alerts, u.sms_alerts, u.created_at,
      COUNT(DISTINCT cz.id)::int  AS zone_count,
      COUNT(DISTINCT al.id)::int  AS alert_count
    FROM users u
    LEFT JOIN coverage_zones cz ON cz.user_id = u.id
    LEFT JOIN alerts_sent    al ON al.user_id = u.id
    WHERE u.role = 'client'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

// GET /api/admin/alerts
router.get('/alerts', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      al.id, al.channel, al.status, al.triggered_by, al.sent_at, al.message_preview,
      u.email AS user_email, u.company_name,
      se.event_type, se.severity, se.location_name, se.state,
      se.hail_size, se.wind_speed, se.event_date
    FROM alerts_sent al
    JOIN  users         u  ON u.id  = al.user_id
    LEFT JOIN storm_events se ON se.id = al.storm_event_id
    ORDER BY al.sent_at DESC
    LIMIT 500
  `);
  res.json(rows);
});

// POST /api/admin/send-alert  { storm_id, user_id? }
// If user_id omitted → send to ALL matching clients (same as auto-run, but manual)
router.post('/send-alert', async (req, res) => {
  const { storm_id, user_id } = req.body;
  if (!storm_id) return res.status(400).json({ error: 'storm_id is required' });

  try {
    if (user_id) {
      const alert = await sendManualAlert(user_id, storm_id);
      return res.json({ success: true, alert });
    }

    // Send to all matching clients
    const { rows } = await pool.query('SELECT * FROM storm_events WHERE id = $1', [storm_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Storm not found' });
    const results = await processStormAlerts(rows[0]);
    res.json({ success: true, alerts_sent: results.length, results });
  } catch (err) {
    console.error('[Admin] send-alert error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to send alert' });
  }
});

// POST /api/admin/run-check   { days_back? }
// Manually triggers a NOAA data fetch + alert cycle
router.post('/run-check', async (req, res) => {
  const daysBack = Math.min(parseInt(req.body?.days_back) || 2, 7);
  try {
    const storms = await fetchRecentStorms(daysBack);
    let newCount = 0, alertCount = 0;

    for (const sd of storms) {
      const { rows: ex } = await pool.query(
        'SELECT id FROM storm_events WHERE noaa_id = $1', [sd.noaa_id]
      );
      if (ex.length) continue;

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
      newCount++;
      const results = await processStormAlerts(ins[0]);
      alertCount += results.filter(r => r.status === 'sent').length;
    }

    res.json({
      success: true,
      storms_fetched: storms.length,
      new_storms: newCount,
      alerts_sent: alertCount,
    });
  } catch (err) {
    console.error('[Admin] run-check error:', err.message);
    res.status(500).json({ error: err.message || 'Storm check failed' });
  }
});

// POST /api/admin/run-forecast
router.post('/run-forecast', async (req, res) => {
  if (!process.env.TOMORROW_API_KEY)
    return res.status(400).json({ error: 'TOMORROW_API_KEY is not configured' });
  try {
    await runForecastCheck();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
