const express = require('express');
const pool    = require('../db');
const { authenticate }   = require('../middleware/auth');
const { geocodeLocation }    = require('../services/geocodeService');
const { processNewZoneAlerts } = require('../services/alertService');

const router = express.Router();

// GET /api/coverage-zones
router.get('/', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM coverage_zones WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

// POST /api/coverage-zones
router.post('/', authenticate, async (req, res) => {
  const { name, input_value, radius_miles = 25 } = req.body;

  if (!name?.trim() || !input_value?.trim())
    return res.status(400).json({ error: 'Zone name and location are required' });

  const radius = parseFloat(radius_miles);
  if (!isFinite(radius) || radius < 1 || radius > 500)
    return res.status(400).json({ error: 'Radius must be between 1 and 500 miles' });

  try {
    // Append ", USA" so Nominatim prioritizes US results
    const geo = await geocodeLocation(`${input_value.trim()}, USA`);

    const { rows } = await pool.query(
      `INSERT INTO coverage_zones (user_id, name, input_value, center_lat, center_lng, radius_miles)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, name.trim(), input_value.trim(), geo.lat, geo.lng, radius]
    );
    const newZone = rows[0];

    // Fire-and-forget: check existing storms and alert immediately
    processNewZoneAlerts(newZone).catch(err =>
      console.error('[Coverage] Post-create alert error:', err.message)
    );

    res.status(201).json(newZone);
  } catch (err) {
    console.error('[Coverage] Create error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create coverage zone' });
  }
});

// DELETE /api/coverage-zones/:id
router.delete('/:id', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM coverage_zones WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Coverage zone not found' });
  res.json({ success: true });
});

module.exports = router;
