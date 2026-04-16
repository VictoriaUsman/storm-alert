const axios = require('axios');

const BASE = 'https://api.tomorrow.io/v4';

const SEVERITY_RANK = { light: 1, moderate: 2, severe: 3 };

function classifyHail(prob) {
  if (prob >= 80) return 'severe';
  if (prob >= 60) return 'moderate';
  return 'light';
}

function classifyWind(mph) {
  if (mph >= 75) return 'severe';
  if (mph >= 58) return 'moderate';
  return 'light';
}

// Returns the single worst forecast event (hail or wind) for the next 24 hours.
// Returns null if nothing exceeds thresholds.
async function checkForecast(lat, lng) {
  const minHailProb = parseFloat(process.env.MIN_HAIL_PROBABILITY) || 40;
  const minWind     = parseFloat(process.env.MIN_WIND_SPEED)        || 40;

  const res = await axios.get(`${BASE}/timelines`, {
    params: {
      location:   `${lat},${lng}`,
      fields:     'hailProbability,windGust',
      timesteps:  '1h',
      startTime:  'now',
      endTime:    'nowPlus24h',
      units:      'imperial',
      apikey:     process.env.TOMORROW_API_KEY,
    },
    timeout: 10000,
  });

  const intervals = res.data?.data?.timelines?.[0]?.intervals || [];

  // Collect worst hail and worst wind event across the 24h window
  let worstHail = null;
  let worstWind = null;

  for (const interval of intervals) {
    const { hailProbability = 0, windGust = 0 } = interval.values;
    const date = interval.startTime.slice(0, 10);

    if (hailProbability >= minHailProb) {
      const sev = classifyHail(hailProbability);
      if (!worstHail || SEVERITY_RANK[sev] > SEVERITY_RANK[worstHail.severity]) {
        worstHail = {
          event_type:   'hail',
          severity:     sev,
          event_date:   date,
          lat, lng,
          hail_size:    null,
          wind_speed:   null,
          location_name: '',
          county:       '',
          state:        '',
          description:  `Forecast: ${Math.round(hailProbability)}% hail probability`,
          source:       'TOMORROW_IO',
          noaa_id:      `forecast_hail_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
        };
      }
    }

    if (windGust >= minWind) {
      const sev = classifyWind(windGust);
      if (!worstWind || SEVERITY_RANK[sev] > SEVERITY_RANK[worstWind.severity]) {
        worstWind = {
          event_type:   'wind',
          severity:     sev,
          event_date:   date,
          lat, lng,
          hail_size:    null,
          wind_speed:   Math.round(windGust),
          location_name: '',
          county:       '',
          state:        '',
          description:  `Forecast: ${Math.round(windGust)} mph wind gust`,
          source:       'TOMORROW_IO',
          noaa_id:      `forecast_wind_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
        };
      }
    }
  }

  return [worstHail, worstWind].filter(Boolean);
}

module.exports = { checkForecast };
