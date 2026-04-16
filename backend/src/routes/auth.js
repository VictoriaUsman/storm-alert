const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, company_name = '', contact_name = '', phone = '' } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'An account with that email already exists' });

    const password_hash = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase()
      ? 'admin' : 'client';

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, company_name, contact_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, company_name, contact_name, phone, role, email_alerts, sms_alerts, created_at`,
      [email.toLowerCase(), password_hash, company_name, contact_name, phone, role]
    );

    res.status(201).json({ user: rows[0], token: signToken(rows[0].id) });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...safe } = user;
    res.json({ user: safe, token: signToken(user.id) });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, company_name, contact_name, phone, role, email_alerts, sms_alerts, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0]);
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const { company_name, contact_name, phone, email_alerts, sms_alerts } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         company_name  = COALESCE($1, company_name),
         contact_name  = COALESCE($2, contact_name),
         phone         = COALESCE($3, phone),
         email_alerts  = COALESCE($4, email_alerts),
         sms_alerts    = COALESCE($5, sms_alerts),
         updated_at    = NOW()
       WHERE id = $6
       RETURNING id, email, company_name, contact_name, phone, role, email_alerts, sms_alerts`,
      [company_name, contact_name, phone, email_alerts, sms_alerts, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

module.exports = router;
