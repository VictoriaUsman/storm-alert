const nodemailer = require('nodemailer');
const pool = require('../db');

// ─── Mailer ───────────────────────────────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

// ─── Geography ────────────────────────────────────────────────────────────────

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Email Template ───────────────────────────────────────────────────────────

const SEVERITY_COLOR = { light: '#e6a817', moderate: '#d4600a', severe: '#c0392b' };

function stormDetail(storm) {
  if (storm.event_type === 'hail')  return `${storm.hail_size}" hail`;
  if (storm.event_type === 'wind')  return `${storm.wind_speed} mph wind`;
  return storm.event_type;
}

function buildEmailHtml(user, storm, zoneName) {
  const color    = SEVERITY_COLOR[storm.severity] || SEVERITY_COLOR.moderate;
  const location = [storm.location_name, storm.county, storm.state].filter(Boolean).join(', ');
  const dateStr  = new Date(storm.event_date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const mapUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?storm=${storm.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:30px auto">
  <tr><td style="background:#16213e;padding:24px 28px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">&#9889; Storm Alert</h1>
    <p style="margin:6px 0 0;color:#aac4e8;font-size:14px">A storm has entered your coverage area</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border:1px solid #e0e0e0">
    <div style="border-left:5px solid ${color};background:${color}18;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
      <div style="color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">
        ${storm.severity} ${storm.event_type}
      </div>
      <div style="font-size:28px;font-weight:700;color:#222;margin-top:4px">${stormDetail(storm)}</div>
    </div>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="color:#888;width:120px">Date</td>
        <td style="font-weight:600">${dateStr}</td>
      </tr>
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="color:#888">Location</td>
        <td style="font-weight:600">${location || 'See map'}</td>
      </tr>
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="color:#888">Your Zone</td>
        <td style="font-weight:600">${zoneName}</td>
      </tr>
      ${storm.hail_size  ? `<tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Hail Size</td><td style="font-weight:600">${storm.hail_size}&quot; diameter</td></tr>` : ''}
      ${storm.wind_speed ? `<tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Wind Speed</td><td style="font-weight:600">${storm.wind_speed} mph</td></tr>` : ''}
    </table>

    <div style="text-align:center;margin-top:28px">
      <a href="${mapUrl}" style="background:#16213e;color:#fff;padding:12px 28px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px">
        View on Map &#8594;
      </a>
    </div>
    ${storm.description ? `<p style="margin-top:20px;font-size:13px;color:#888;font-style:italic">${storm.description}</p>` : ''}
  </td></tr>

  <tr><td style="background:#f9f9f9;padding:16px 28px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;border-top:0;text-align:center;font-size:12px;color:#999">
    You're receiving this because your coverage zone <strong>${zoneName}</strong> overlaps this event.
    <br>Data source: NOAA Storm Prediction Center
  </td></tr>
</table>
</body></html>`;
}

// ─── Core Alert Logic ─────────────────────────────────────────────────────────

async function findMatchingClients(storm) {
  const { rows } = await pool.query(`
    SELECT
      u.id, u.email, u.company_name, u.email_alerts,
      cz.id   AS zone_id,
      cz.name AS zone_name,
      cz.center_lat,
      cz.center_lng,
      cz.radius_miles
    FROM users u
    JOIN coverage_zones cz ON cz.user_id = u.id
    WHERE u.email_alerts = true
  `);

  return rows.filter((r) =>
    haversineDistanceMiles(
      storm.lat, storm.lng,
      parseFloat(r.center_lat), parseFloat(r.center_lng)
    ) <= parseFloat(r.radius_miles)
  );
}

async function sendEmailAlert(userEmail, storm, zoneName) {
  const html    = buildEmailHtml({ email: userEmail }, storm, zoneName);
  const loc     = [storm.location_name, storm.state].filter(Boolean).join(', ');
  const subject = `Storm Alert: ${storm.severity.toUpperCase()} ${storm.event_type} near ${loc || 'your area'}`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      userEmail,
    subject,
    html,
  });
}

async function processStormAlerts(storm) {
  const matches = await findMatchingClients(storm);
  const results = [];

  for (const m of matches) {
    // Skip if auto-alert already sent (enforced by partial unique index too)
    const { rows: existing } = await pool.query(
      `SELECT id FROM alerts_sent
       WHERE user_id = $1 AND storm_event_id = $2 AND channel = 'email' AND triggered_by = 'auto'`,
      [m.id, storm.id]
    );
    if (existing.length) continue;

    let status = 'sent';
    let preview = `${storm.severity} ${storm.event_type} near ${storm.location_name || storm.state}`;
    try {
      await sendEmailAlert(m.email, storm, m.zone_name);
    } catch (err) {
      console.error(`[Alert] Email failed → ${m.email}:`, err.message);
      status  = 'failed';
      preview = err.message.slice(0, 200);
    }

    try {
      await pool.query(
        `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
         VALUES ($1, $2, 'email', $3, $4, 'auto')
         ON CONFLICT DO NOTHING`,
        [m.id, storm.id, status, preview]
      );
    } catch (dbErr) {
      console.error('[Alert] Failed to log alert:', dbErr.message);
    }

    results.push({ userId: m.id, email: m.email, status });
  }

  return results;
}

async function sendManualAlert(userId, stormId) {
  const [{ rows: u }, { rows: s }] = await Promise.all([
    pool.query('SELECT * FROM users WHERE id = $1', [userId]),
    pool.query('SELECT * FROM storm_events WHERE id = $1', [stormId]),
  ]);
  if (!u[0]) throw new Error('User not found');
  if (!s[0]) throw new Error('Storm not found');

  const user  = u[0];
  const storm = s[0];
  const { rows: zones } = await pool.query(
    'SELECT name FROM coverage_zones WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  const zoneName = zones[0]?.name || 'Your Coverage Area';

  await sendEmailAlert(user.email, storm, zoneName);

  const { rows } = await pool.query(
    `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
     VALUES ($1, $2, 'manual', 'sent', $3, 'admin')
     RETURNING *`,
    [userId, stormId, `Manual: ${storm.severity} ${storm.event_type}`]
  );
  return rows[0];
}

// Called when a new coverage zone is created — checks existing storms and alerts immediately
async function processNewZoneAlerts(zone) {
  const { rows: users } = await pool.query(
    'SELECT id, email, email_alerts FROM users WHERE id = $1',
    [zone.user_id]
  );
  const user = users[0];
  if (!user?.email_alerts) return [];

  // Check last 7 days of storms so the user sees relevant recent activity
  const { rows: storms } = await pool.query(
    `SELECT * FROM storm_events
     WHERE event_date >= NOW() - INTERVAL '7 days'
     ORDER BY event_date DESC`
  );

  const matching = storms.filter(s =>
    haversineDistanceMiles(
      parseFloat(s.lat), parseFloat(s.lng),
      parseFloat(zone.center_lat), parseFloat(zone.center_lng)
    ) <= parseFloat(zone.radius_miles)
  );

  const results = [];
  for (const storm of matching) {
    const { rows: existing } = await pool.query(
      `SELECT id FROM alerts_sent WHERE user_id = $1 AND storm_event_id = $2 AND channel = 'email'`,
      [user.id, storm.id]
    );
    if (existing.length) continue;

    let status = 'sent';
    const preview = `${storm.severity} ${storm.event_type} near ${storm.location_name || storm.state}`;
    try {
      await sendEmailAlert(user.email, storm, zone.name);
    } catch (err) {
      console.error(`[Alert] New zone email failed → ${user.email}:`, err.message);
      status = 'failed';
    }

    await pool.query(
      `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
       VALUES ($1, $2, 'email', $3, $4, 'auto') ON CONFLICT DO NOTHING`,
      [user.id, storm.id, status, preview]
    );
    results.push({ stormId: storm.id, status });
  }

  console.log(`[Alert] New zone "${zone.name}" — ${matching.length} storms found, ${results.filter(r => r.status === 'sent').length} alerts sent`);
  return results;
}

module.exports = { processStormAlerts, sendManualAlert, findMatchingClients, processNewZoneAlerts };
