require('dotenv').config();
const axios = require('axios');
const { checkForecast } = require('./src/services/tomorrowService');

const LAT = parseFloat(process.env.TEST_LAT) || 42.9042;
const LNG = parseFloat(process.env.TEST_LNG) || -72.1915;

console.log(`Tomorrow.io forecast test — ${LAT}, ${LNG}`);
console.log(`API key: ${process.env.TOMORROW_API_KEY ? process.env.TOMORROW_API_KEY.slice(0, 8) + '...' : '(not set)'}\n`);

if (!process.env.TOMORROW_API_KEY) {
  console.error('TOMORROW_API_KEY is not set in .env');
  process.exit(1);
}

async function run() {
  // ── 1. Raw current conditions ─────────────────────────────────────────────
  console.log('─── Current Conditions ───────────────────────────────────────');
  const realtime = await axios.get('https://api.tomorrow.io/v4/weather/realtime', {
    params: {
      location: `${LAT},${LNG}`,
      fields:   'temperature,humidity,windSpeed,windGust,precipitationIntensity,weatherCode,snowAccumulation,iceAccumulation,hailProbability',
      units:    'imperial',
      apikey:   process.env.TOMORROW_API_KEY,
    },
    timeout: 10000,
  });

  const c = realtime.data?.data?.values || {};
  const weatherLabels = {
    1000: 'Clear', 1100: 'Mostly Clear', 1101: 'Partly Cloudy', 1102: 'Mostly Cloudy',
    1001: 'Cloudy', 2000: 'Fog', 2100: 'Light Fog',
    4000: 'Drizzle', 4001: 'Rain', 4200: 'Light Rain', 4201: 'Heavy Rain',
    5000: 'Snow', 5001: 'Flurries', 5100: 'Light Snow', 5101: 'Heavy Snow',
    6000: 'Freezing Drizzle', 6001: 'Freezing Rain', 6200: 'Light Freezing Rain', 6201: 'Heavy Freezing Rain',
    7000: 'Ice Pellets', 7101: 'Heavy Ice Pellets', 7102: 'Light Ice Pellets',
    8000: 'Thunderstorm', 8001: 'Heavy Thunderstorm', 8003: 'Thunderstorm w/ Hail',
  };

  console.log(`  Weather:       ${weatherLabels[c.weatherCode] || `Code ${c.weatherCode}`}`);
  console.log(`  Temperature:   ${c.temperature?.toFixed(1)}°F`);
  console.log(`  Humidity:      ${c.humidity?.toFixed(0)}%`);
  console.log(`  Wind Speed:    ${c.windSpeed?.toFixed(1)} mph`);
  console.log(`  Wind Gust:     ${c.windGust?.toFixed(1)} mph`);
  console.log(`  Precipitation: ${c.precipitationIntensity?.toFixed(2)} mm/hr`);
  if (c.hailProbability)    console.log(`  Hail Prob:     ${c.hailProbability?.toFixed(0)}%`);
  if (c.snowAccumulation)   console.log(`  Snow Accum:    ${c.snowAccumulation?.toFixed(2)}"`);
  if (c.iceAccumulation)    console.log(`  Ice Accum:     ${c.iceAccumulation?.toFixed(2)}"`);

  // ── 2. Alert-worthy events in next 24h ────────────────────────────────────
  console.log('\n─── Severe Weather Alerts (next 24h) ─────────────────────────');
  const events = await checkForecast(LAT, LNG);

  if (!events.length) {
    console.log('  No severe weather forecast — all conditions below alert thresholds.');
  } else {
    events.forEach(e => {
      console.log(`\n  [${e.event_type.toUpperCase()}] ${e.severity}`);
      console.log(`  ${e.description}`);
      console.log(`  Date: ${e.event_date}`);
    });
  }

  console.log('\n──────────────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('Failed:', err.response?.data || err.message);
});
