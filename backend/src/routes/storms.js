const express = require('express');
const pool    = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/storms?days=7
router.get('/', authenticate, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 60);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM storm_events
       WHERE event_date >= NOW() - ($1 || ' days')::INTERVAL
       ORDER BY event_date DESC, created_at DESC
       LIMIT 2000`,
      [days]
    );
    res.json(rows);
  } catch (err) {
    console.error('[Storms] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch storm events' });
  }
});

// GET /api/storms/:id
router.get('/:id', authenticate, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM storm_events WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Storm not found' });
  res.json(rows[0]);
});

module.exports = router;
