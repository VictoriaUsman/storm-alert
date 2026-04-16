const axios = require('axios');

// Uses OpenStreetMap Nominatim — free, no API key required.
// Rate limit: 1 req/sec; perfectly fine for MVP usage.
async function geocodeLocation(query) {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: query, format: 'json', limit: 1, countrycodes: 'us' },
    headers: { 'User-Agent': `StormAlertMVP/1.0 (${process.env.CONTACT_EMAIL || 'contact@example.com'})` },
    timeout: 8000,
  });

  if (!response.data?.length) {
    throw new Error(`Location not found: "${query}". Try adding a state (e.g. "Austin, TX").`);
  }

  const { lat, lon, display_name } = response.data[0];
  return { lat: parseFloat(lat), lng: parseFloat(lon), displayName: display_name };
}

module.exports = { geocodeLocation };
