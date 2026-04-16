/**
 * Fetches and parses NOAA Storm Prediction Center (SPC) daily storm reports.
 *
 * SPC publishes CSV reports at:
 *   https://www.spc.noaa.gov/climo/reports/YYMMDD_rpts_hail.csv
 *   https://www.spc.noaa.gov/climo/reports/YYMMDD_rpts_wind.csv
 *
 * CSV columns: Time, F_Scale, Location, County, State, Lat, Lon, Comments
 *   - Time     : UTC HHMM
 *   - F_Scale  : hail size in inches (hail) OR wind speed in mph (wind)
 */
const axios = require('axios');
const { parse } = require('csv-parse/sync');

function toSPCDateStr(date) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function classifyHail(inches) {
  if (inches >= 2.0) return 'severe';
  if (inches >= 0.75) return 'moderate';
  return 'light';
}

function classifyWind(mph) {
  if (mph >= 75) return 'severe';
  if (mph >= 50) return 'moderate';
  return 'light';
}

async function fetchCSV(url) {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'StormAlertMVP/1.0' },
      responseType: 'text',
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

function parseSPC(csvText, type, date, index) {
  if (!csvText?.trim()) return [];

  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    console.warn(`[NOAA] CSV parse error (${type}):`, err.message);
    return [];
  }

  const dateStr = date.toISOString().split('T')[0];
  const minHail = parseFloat(process.env.MIN_HAIL_SIZE) || 0.75;
  const minWind = parseFloat(process.env.MIN_WIND_SPEED) || 40;
  const results = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      // Column names vary slightly across SPC file versions — handle both
      const lat = parseFloat(row.Lat ?? row.LAT ?? row.lat);
      const lng = parseFloat(row.Lon ?? row.LON ?? row.lon);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const magnitude = parseFloat(
        row.F_Scale ?? row.Magnitude ?? row.Speed ?? row.Size ?? '0'
      ) || 0;

      const location = (row.Location ?? '').trim();
      const county   = (row.County   ?? '').trim();
      const state    = (row.State    ?? '').trim().toUpperCase().slice(0, 2);
      const comment  = (row.Comments ?? '').trim();
      const noaa_id  = `${type}_${dateStr}_${lat}_${lng}_${index}_${i}`;

      if (type === 'hail') {
        if (magnitude < minHail) continue;
        results.push({
          event_date:    dateStr,
          event_type:    'hail',
          severity:      classifyHail(magnitude),
          lat, lng, location_name: location, county, state,
          hail_size:     magnitude,
          wind_speed:    null,
          description:   comment,
          noaa_id,
        });
      } else if (type === 'wind') {
        if (magnitude < minWind) continue;
        results.push({
          event_date:    dateStr,
          event_type:    'wind',
          severity:      classifyWind(magnitude),
          lat, lng, location_name: location, county, state,
          hail_size:     null,
          wind_speed:    magnitude,
          description:   comment,
          noaa_id,
        });
      }
    } catch {
      // skip malformed rows
    }
  }
  return results;
}

async function fetchRecentStorms(daysBack = 2) {
  const all = [];
  const BASE = 'https://www.spc.noaa.gov/climo/reports';

  for (let d = 0; d <= daysBack; d++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - d);
    const ds = toSPCDateStr(date);

    for (const type of ['hail', 'wind']) {
      // Try the standard archive URL first, fall back to "today" shortcut
      const urls = [
        `${BASE}/${ds}_rpts_${type}.csv`,
        d === 0 ? `${BASE}/today_1200_${type}.csv` : null,
      ].filter(Boolean);

      for (const url of urls) {
        try {
          const csv = await fetchCSV(url);
          if (csv) {
            const parsed = parseSPC(csv, type, date, d);
            all.push(...parsed);
            break; // got data from this URL, don't try fallback
          }
        } catch (err) {
          console.warn(`[NOAA] Failed to fetch ${url}:`, err.message);
        }
      }
    }
  }

  return all;
}

module.exports = { fetchRecentStorms };
