const { google } = require('googleapis');
const pool = require('../db');

// ─── Mailer (Gmail REST API — works on Railway, no SMTP ports needed) ─────────

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

// ─── Geography ────────────────────────────────────────────────────────────────

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Email Templates ──────────────────────────────────────────────────────────

const SEVERITY_COLOR = { light: '#e6a817', moderate: '#d4600a', severe: '#c0392b' };

function stormDetail(storm) {
  if (storm.event_type === 'hail') return `${storm.hail_size}" hail`;
  if (storm.event_type === 'wind') return `${storm.wind_speed} mph wind`;
  return storm.event_type;
}

function severityBadge(severity, type) {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.moderate;
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.5px">${severity} ${type}</span>`;
}

// Single storm alert email (used by ongoing cron alerts)
function buildEmailHtml(user, storm, zoneName) {
  const color    = SEVERITY_COLOR[storm.severity] || SEVERITY_COLOR.moderate;
  const location = [storm.location_name, storm.county, storm.state].filter(Boolean).join(', ');
  const dateStr  = new Date(storm.event_date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const mapUrl   = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?storm=${storm.id}`;
  const isForecast = storm.source === 'TOMORROW_IO';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:30px auto">
  <tr><td style="background:#16213e;padding:24px 28px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">${isForecast ? '&#x1F4E1; Storm Forecast' : '&#9889; Storm Alert'}</h1>
    <p style="margin:6px 0 0;color:#aac4e8;font-size:14px">${isForecast ? 'A storm is forecast to enter your coverage area' : 'A storm has entered your coverage area'}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px;border:1px solid #e0e0e0">
    <div style="border-left:5px solid ${color};background:${color}18;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px">
      <div style="color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${storm.severity} ${storm.event_type}</div>
      <div style="font-size:28px;font-weight:700;color:#222;margin-top:4px">${stormDetail(storm)}</div>
    </div>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      <tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888;width:120px">Date</td><td style="font-weight:600">${dateStr}</td></tr>
      <tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Location</td><td style="font-weight:600">${location || 'See map'}</td></tr>
      <tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Your Zone</td><td style="font-weight:600">${zoneName}</td></tr>
      ${storm.hail_size  ? `<tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Hail Size</td><td style="font-weight:600">${storm.hail_size}&quot; diameter</td></tr>` : ''}
      ${storm.wind_speed ? `<tr style="border-bottom:1px solid #f0f0f0"><td style="color:#888">Wind Speed</td><td style="font-weight:600">${storm.wind_speed} mph</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin-top:28px">
      <a href="${mapUrl}" style="background:#16213e;color:#fff;padding:12px 28px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px">View on Map &#8594;</a>
    </div>
    ${storm.description ? `<p style="margin-top:20px;font-size:13px;color:#888;font-style:italic">${storm.description}</p>` : ''}
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:16px 28px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;border-top:0;text-align:center;font-size:12px;color:#999">
    You're receiving this because your coverage zone <strong>${zoneName}</strong> overlaps this event.
    <br>Data source: ${isForecast ? 'Tomorrow.io Forecast' : 'NOAA Storm Prediction Center'}
  </td></tr>
</table>
</body></html>`;
}

// Combined zone report email — sent once when a new coverage zone is created
function buildZoneReportEmailHtml(userEmail, zoneName, recentStorm, forecasts) {
  const mapUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;

  const stormSection = recentStorm ? (() => {
    const color    = SEVERITY_COLOR[recentStorm.severity] || SEVERITY_COLOR.moderate;
    const location = [recentStorm.location_name, recentStorm.county, recentStorm.state].filter(Boolean).join(', ');
    const dateStr  = new Date(recentStorm.event_date + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
    return `
    <div style="margin-bottom:24px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:10px">
        &#9889; Most Recent Confirmed Storm
      </div>
      <div style="border:1px solid #e8e8e8;border-left:4px solid ${color};border-radius:4px;padding:14px 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            ${severityBadge(recentStorm.severity, recentStorm.event_type)}
            <div style="font-size:20px;font-weight:700;margin-top:6px;color:#222">${stormDetail(recentStorm)}</div>
            <div style="font-size:13px;color:#666;margin-top:4px">${location || 'See map'}</div>
          </div>
          <div style="font-size:12px;color:#999;white-space:nowrap;margin-left:12px">${dateStr}</div>
        </div>
      </div>
    </div>`;
  })() : '';

  const forecastSection = forecasts?.length ? (() => {
    const items = forecasts.map(f => {
      const color = SEVERITY_COLOR[f.severity] || SEVERITY_COLOR.moderate;
      return `
      <div style="border:1px solid #e8e8e8;border-left:4px solid ${color};border-radius:4px;padding:12px 16px;margin-bottom:8px">
        ${severityBadge(f.severity, f.event_type)}
        <div style="font-size:16px;font-weight:700;margin-top:4px;color:#222">${f.description}</div>
        <div style="font-size:12px;color:#999;margin-top:2px">Forecast for ${f.event_date}</div>
      </div>`;
    }).join('');
    return `
    <div style="margin-bottom:24px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:10px">
        &#x1F4E1; Upcoming Forecast (Next 24 Hours)
      </div>
      ${items}
    </div>`;
  })() : '';

  const noActivitySection = (!recentStorm && !forecasts?.length) ? `
    <div style="text-align:center;padding:24px;background:#f8f9fb;border-radius:6px;color:#888;font-size:14px;margin-bottom:24px">
      No recent storms or active forecasts in this zone. You'll be notified as soon as activity is detected.
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:30px auto">
  <tr><td style="background:#16213e;padding:24px 28px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">&#x1F6E1; Coverage Zone Activated</h1>
    <p style="margin:6px 0 0;color:#aac4e8;font-size:14px">Zone <strong style="color:#fff">${zoneName}</strong> is now monitoring for storm activity</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px;border:1px solid #e0e0e0">
    ${stormSection}
    ${forecastSection}
    ${noActivitySection}
    <div style="text-align:center;margin-top:8px">
      <a href="${mapUrl}" style="background:#16213e;color:#fff;padding:12px 28px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px">View Dashboard &#8594;</a>
    </div>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:16px 28px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;border-top:0;text-align:center;font-size:12px;color:#999">
    Monitoring zone <strong>${zoneName}</strong> · Storm data: NOAA SPC + Tomorrow.io
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

async function sendRawEmail(to, subject, html) {
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER;
  const raw  = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n');

  await getGmailClient().users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(raw).toString('base64url') },
  });
}

async function sendEmailAlert(userEmail, storm, zoneName) {
  const html  = buildEmailHtml({ email: userEmail }, storm, zoneName);
  const loc   = [storm.location_name, storm.state].filter(Boolean).join(', ');
  const subject = `Storm Alert: ${storm.severity.toUpperCase()} ${storm.event_type} near ${loc || 'your area'}`;
  await sendRawEmail(userEmail, subject, html);
}

async function processStormAlerts(storm) {
  const matches = await findMatchingClients(storm);
  const results = [];

  for (const m of matches) {
    const preview = `${storm.severity} ${storm.event_type} near ${storm.location_name || storm.state}`;

    // Claim the slot — retry if previously failed, skip if already sent
    const { rows: claimed } = await pool.query(
      `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
       VALUES ($1, $2, 'email', 'pending', $3, 'auto')
       ON CONFLICT (user_id, storm_event_id, channel) WHERE triggered_by = 'auto'
       DO UPDATE SET status = 'pending', sent_at = NOW()
       WHERE alerts_sent.status = 'failed'
       RETURNING id`,
      [m.id, storm.id, preview]
    );
    if (!claimed.length) continue;

    let status = 'sent';
    try {
      await sendEmailAlert(m.email, storm, m.zone_name);
    } catch (err) {
      console.error(`[Alert] Email failed → ${m.email}:`, err.message);
      status = 'failed';
    }

    await pool.query(
      `UPDATE alerts_sent SET status = $1 WHERE user_id = $2 AND storm_event_id = $3 AND channel = 'email' AND triggered_by = 'auto'`,
      [status, m.id, storm.id]
    );

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
    'SELECT name FROM coverage_zones WHERE user_id = $1 LIMIT 1', [userId]
  );
  const zoneName = zones[0]?.name || 'Your Coverage Area';

  await sendEmailAlert(user.email, storm, zoneName);

  const { rows } = await pool.query(
    `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
     VALUES ($1, $2, 'manual', 'sent', $3, 'admin') RETURNING *`,
    [userId, stormId, `Manual: ${storm.severity} ${storm.event_type}`]
  );
  return rows[0];
}

// Called when a new coverage zone is created —
// sends ONE combined email with the most recent NOAA storm + Tomorrow.io forecast
async function processNewZoneAlerts(zone) {
  const { rows: users } = await pool.query(
    'SELECT id, email, email_alerts FROM users WHERE id = $1', [zone.user_id]
  );
  const user = users[0];
  if (!user?.email_alerts) return [];

  // ── 1. Most recent confirmed NOAA storm in zone ───────────────────────────
  const { rows: storms } = await pool.query(
    `SELECT * FROM storm_events
     WHERE event_date >= NOW() - INTERVAL '7 days'
       AND source = 'NOAA_SPC'
     ORDER BY event_date DESC`
  );

  const recentStorm = storms.find(s =>
    haversineDistanceMiles(
      parseFloat(s.lat), parseFloat(s.lng),
      parseFloat(zone.center_lat), parseFloat(zone.center_lng)
    ) <= parseFloat(zone.radius_miles)
  ) || null;

  // ── 2. Tomorrow.io forecast (if configured) ───────────────────────────────
  let forecasts = [];
  if (process.env.TOMORROW_API_KEY) {
    try {
      const { checkForecast } = require('./tomorrowService');
      forecasts = await checkForecast(
        parseFloat(zone.center_lat),
        parseFloat(zone.center_lng)
      );
    } catch (err) {
      console.error('[Alert] Forecast fetch failed:', err.message);
    }
  }

  // ── 3. Send combined email ────────────────────────────────────────────────
  const html    = buildZoneReportEmailHtml(user.email, zone.name, recentStorm, forecasts);
  const subject = `Zone Activated: ${zone.name} is now monitoring for storms`;

  let status = 'sent';
  try {
    await sendRawEmail(user.email, subject, html);
  } catch (err) {
    console.error(`[Alert] Zone report email failed → ${user.email}:`, err.message);
    status = 'failed';
  }

  // ── 4. Log dedup record for the NOAA storm so cron doesn't re-alert ───────
  if (recentStorm) {
    await pool.query(
      `INSERT INTO alerts_sent (user_id, storm_event_id, channel, status, message_preview, triggered_by)
       VALUES ($1, $2, 'email', $3, $4, 'auto')
       ON CONFLICT (user_id, storm_event_id, channel) WHERE triggered_by = 'auto'
       DO UPDATE SET status = $3
       WHERE alerts_sent.status = 'failed'`,
      [user.id, recentStorm.id, status, `Zone report: ${zone.name}`]
    );
  }

  console.log(
    `[Alert] New zone "${zone.name}" — storm: ${recentStorm ? 'yes' : 'none'}, ` +
    `forecasts: ${forecasts.length}, email: ${status}`
  );

  return [{ status }];
}

module.exports = { processStormAlerts, sendManualAlert, findMatchingClients, processNewZoneAlerts };
