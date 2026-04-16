require('dotenv').config();
const { checkForecast } = require('./src/services/tomorrowService');

// Test with your coverage zone coordinates
const LAT =  42.9042;
const LNG = -72.1915;

console.log(`Testing Tomorrow.io forecast for ${LAT}, ${LNG}...`);
console.log(`API key: ${process.env.TOMORROW_API_KEY ? process.env.TOMORROW_API_KEY.slice(0, 8) + '...' : '(not set)'}\n`);

if (!process.env.TOMORROW_API_KEY) {
  console.error('TOMORROW_API_KEY is not set in .env');
  process.exit(1);
}

checkForecast(LAT, LNG)
  .then(events => {
    if (!events.length) {
      console.log('No severe weather forecast in the next 24 hours for this location.');
    } else {
      console.log(`Found ${events.length} forecast event(s):\n`);
      events.forEach(e => {
        console.log(`  Type:     ${e.event_type}`);
        console.log(`  Severity: ${e.severity}`);
        console.log(`  Date:     ${e.event_date}`);
        console.log(`  Detail:   ${e.description}`);
        console.log(`  noaa_id:  ${e.noaa_id}`);
        console.log();
      });
    }
  })
  .catch(err => {
    console.error('Forecast check failed:', err.response?.data || err.message);
  });
