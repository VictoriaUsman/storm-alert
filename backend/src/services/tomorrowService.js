const axios = require('axios');

const BASE = 'https://api.tomorrow.io/v4';

const SEVERITY_RANK = { light: 1, moderate: 2, severe: 3 };

// ─── Classification ───────────────────────────────────────────────────────────

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

function classifyRain(mmhr) {
  if (mmhr >= 25) return 'severe';
  if (mmhr >= 10) return 'moderate';
  return 'light';
}

function classifySnow(inches) {
  if (inches >= 6) return 'severe';
  if (inches >= 2) return 'moderate';
  return 'light';
}

function classifyIce(inches) {
  if (inches >= 0.25) return 'severe';
  if (inches >= 0.1)  return 'moderate';
  return 'light';
}

// Tomorrow.io weather codes for thunderstorms
const THUNDERSTORM_CODES = new Set([8000, 8001, 8003]);

// ─── Weather code labels ──────────────────────────────────────────────────────

const WEATHER_LABELS = {
  1000: 'Clear', 1100: 'Mostly Clear', 1101: 'Partly Cloudy', 1102: 'Mostly Cloudy',
  1001: 'Cloudy', 2000: 'Fog', 2100: 'Light Fog',
  4000: 'Drizzle', 4001: 'Rain', 4200: 'Light Rain', 4201: 'Heavy Rain',
  5000: 'Snow', 5001: 'Flurries', 5100: 'Light Snow', 5101: 'Heavy Snow',
  6000: 'Freezing Drizzle', 6001: 'Freezing Rain',
  6200: 'Light Freezing Rain', 6201: 'Heavy Freezing Rain',
  7000: 'Ice Pellets', 7101: 'Heavy Ice Pellets', 7102: 'Light Ice Pellets',
  8000: 'Thunderstorm', 8001: 'Heavy Thunderstorm', 8003: 'Thunderstorm with Hail',
};

// ─── Current conditions ───────────────────────────────────────────────────────

async function getCurrentConditions(lat, lng) {
  const res = await axios.get(`${BASE}/weather/realtime`, {
    params: {
      location: `${lat},${lng}`,
      fields:   'temperature,humidity,windSpeed,windGust,precipitationIntensity,weatherCode,hailProbability',
      units:    'imperial',
      apikey:   process.env.TOMORROW_API_KEY,
    },
    timeout: 10000,
  });

  const v = res.data?.data?.values || {};
  return {
    weather:       WEATHER_LABELS[v.weatherCode] || 'Unknown',
    temperature:   v.temperature   != null ? `${v.temperature.toFixed(0)}°F`  : null,
    humidity:      v.humidity      != null ? `${v.humidity.toFixed(0)}%`       : null,
    windSpeed:     v.windSpeed     != null ? `${v.windSpeed.toFixed(0)} mph`   : null,
    windGust:      v.windGust      != null ? `${v.windGust.toFixed(0)} mph`    : null,
    precipitation: v.precipitationIntensity > 0 ? `${v.precipitationIntensity.toFixed(2)} mm/hr` : 'None',
    hailProbability: v.hailProbability > 0 ? `${v.hailProbability.toFixed(0)}%` : null,
  };
}

// ─── Main forecast function ───────────────────────────────────────────────────

async function checkForecast(lat, lng) {
  const thresholds = {
    hailProb:  parseFloat(process.env.MIN_HAIL_PROBABILITY) || 40,  // %
    windGust:  parseFloat(process.env.MIN_WIND_SPEED)        || 40,  // mph
    rainIntensity: 10,   // mm/hr — heavy rain
    snowAccum:     2,    // inches over next 24h
    iceAccum:      0.1,  // inches over next 24h
  };

  const res = await axios.get(`${BASE}/timelines`, {
    params: {
      location:  `${lat},${lng}`,
      fields:    'hailProbability,windGust,precipitationIntensity,weatherCode,snowAccumulation,iceAccumulation',
      timesteps: '1h',
      startTime: 'now',
      endTime:   'nowPlus24h',
      units:     'imperial',
      apikey:    process.env.TOMORROW_API_KEY,
    },
    timeout: 10000,
  });

  const intervals = res.data?.data?.timelines?.[0]?.intervals || [];

  // Track worst event per type per day
  const worst = {};

  function track(key, candidate) {
    if (!worst[key] || SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[worst[key].severity]) {
      worst[key] = candidate;
    }
  }

  for (const interval of intervals) {
    const v    = interval.values;
    const date = interval.startTime.slice(0, 10);

    // ── Hail ──────────────────────────────────────────────────────────────
    if ((v.hailProbability || 0) >= thresholds.hailProb) {
      track(`hail_${date}`, {
        event_type: 'hail',
        severity:   classifyHail(v.hailProbability),
        event_date: date, lat, lng,
        hail_size: null, wind_speed: null,
        location_name: '', county: '', state: '',
        description: `Forecast: ${Math.round(v.hailProbability)}% hail probability`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_hail_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }

    // ── Wind ──────────────────────────────────────────────────────────────
    if ((v.windGust || 0) >= thresholds.windGust) {
      track(`wind_${date}`, {
        event_type: 'wind',
        severity:   classifyWind(v.windGust),
        event_date: date, lat, lng,
        hail_size: null, wind_speed: Math.round(v.windGust),
        location_name: '', county: '', state: '',
        description: `Forecast: ${Math.round(v.windGust)} mph wind gust`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_wind_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }

    // ── Thunderstorm ──────────────────────────────────────────────────────
    if (THUNDERSTORM_CODES.has(v.weatherCode)) {
      const sev = v.weatherCode === 8001 ? 'severe' : 'moderate';
      track(`thunderstorm_${date}`, {
        event_type: 'thunderstorm',
        severity:   sev,
        event_date: date, lat, lng,
        hail_size: null, wind_speed: null,
        location_name: '', county: '', state: '',
        description: `Forecast: ${sev === 'severe' ? 'Heavy' : ''} Thunderstorm`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_thunderstorm_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }

    // ── Heavy Rain ────────────────────────────────────────────────────────
    if ((v.precipitationIntensity || 0) >= thresholds.rainIntensity) {
      track(`rain_${date}`, {
        event_type: 'rain',
        severity:   classifyRain(v.precipitationIntensity),
        event_date: date, lat, lng,
        hail_size: null, wind_speed: null,
        location_name: '', county: '', state: '',
        description: `Forecast: Heavy rain ${Math.round(v.precipitationIntensity)} mm/hr`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_rain_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }

    // ── Snow ──────────────────────────────────────────────────────────────
    if ((v.snowAccumulation || 0) >= thresholds.snowAccum) {
      track(`snow_${date}`, {
        event_type: 'snow',
        severity:   classifySnow(v.snowAccumulation),
        event_date: date, lat, lng,
        hail_size: null, wind_speed: null,
        location_name: '', county: '', state: '',
        description: `Forecast: ${v.snowAccumulation.toFixed(1)}" snow accumulation`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_snow_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }

    // ── Ice ───────────────────────────────────────────────────────────────
    if ((v.iceAccumulation || 0) >= thresholds.iceAccum) {
      track(`ice_${date}`, {
        event_type: 'ice',
        severity:   classifyIce(v.iceAccumulation),
        event_date: date, lat, lng,
        hail_size: null, wind_speed: null,
        location_name: '', county: '', state: '',
        description: `Forecast: ${v.iceAccumulation.toFixed(2)}" ice accumulation`,
        source:  'TOMORROW_IO',
        noaa_id: `forecast_ice_${lat.toFixed(2)}_${lng.toFixed(2)}_${date}`,
      });
    }
  }

  return Object.values(worst);
}

module.exports = { checkForecast, getCurrentConditions };
