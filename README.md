# StormAlert MVP

Real-time hail & wind storm alerts for roofing contractors and service companies.

## What it does

- Clients set **coverage zones** (zip code, city, or address + radius)
- An interactive **storm map** shows recent NOAA SPC hail/wind events, color-coded by severity
- **Email alerts** are sent automatically when a storm enters a client's coverage area
- **Admin dashboard** shows all clients, the alert log, and lets you manually trigger alerts

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [PostgreSQL](https://www.postgresql.org/) 14+ running locally (or a hosted instance)
- A Gmail account configured for OAuth2 (see [Gmail setup](#gmail-oauth2-setup))

---

## Setup

### 1 — Create the database

```bash
psql -U postgres -c "CREATE DATABASE storm_alerts;"
```

### 2 — Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:yourpassword@localhost:5432/storm_alerts` |
| `JWT_SECRET` | Random string, **32+ characters** — use `openssl rand -hex 32` |
| `ADMIN_EMAIL` | The email you'll register with first — it gets the admin role |
| `GMAIL_CLIENT_ID` | OAuth2 client ID from Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Refresh token from OAuth2 Playground |
| `GMAIL_USER` | Your Gmail address (used as sender) |
| `EMAIL_FROM` | Display name + address, e.g. `StormAlert <you@gmail.com>` |
| `FRONTEND_URL` | Production URL of the frontend (used in email links and CORS) |

### 3 — Run the database schema

```bash
cd backend
npm install
npm run db:setup
```

### 4 — Start the backend

```bash
# In backend/
npm run dev        # development (nodemon)
# or
npm start          # production
```

API runs on **http://localhost:3001**

### 5 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on **http://localhost:5173**

---

## First run

1. Open http://localhost:5173 → **Create Account** using the email in `ADMIN_EMAIL`
2. You'll be logged in as admin
3. Go to **Settings** and add a coverage zone (try a zip code like `77001` for Houston)
4. Click **Admin → Run Storm Check** to pull the latest NOAA data immediately
5. Open the **Map** tab to see recent storm events

---

## Storm data

NOAA Storm Prediction Center publishes daily CSV storm reports (hail & wind) at:
```
https://www.spc.noaa.gov/climo/reports/
```
No API key required. The backend polls these on the configured cron schedule (default: every 6 hours).

**Severity thresholds** (configurable via `.env`):

| Type | Light | Moderate | Severe |
|------|-------|----------|--------|
| Hail | < 0.75" | 0.75–1.99" | ≥ 2.0" |
| Wind | < 50 mph | 50–74 mph | ≥ 75 mph |

---

## Deployment

**Backend** → [Railway](https://railway.app) or [Render](https://render.com)
- Set all environment variables in the dashboard
- Add a managed PostgreSQL database
- Set `NODE_ENV=production`

**Frontend** → [Vercel](https://vercel.com)
- Set the Vite proxy target to your deployed backend URL in production, or configure `VITE_API_URL`

---

## Project structure

```
storm-alert/
├── backend/
│   ├── src/
│   │   ├── db/           schema.sql, pool setup
│   │   ├── middleware/   JWT auth
│   │   ├── routes/       auth, coverage-zones, storms, admin
│   │   ├── services/     noaaService, geocodeService, alertService, tomorrowService
│   │   ├── jobs/         stormChecker, forecastChecker (cron)
│   │   └── utils/        httpClient (axios + retry)
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/        Login, Dashboard, Settings, Admin
        ├── components/   Navbar, StormMap, CoverageZoneForm
        ├── context/      AuthContext
        └── api/          axios client
```

---

## Security

### Rate limiting

| Scope | Limit |
|-------|-------|
| All routes (global) | 200 req / 15 min per IP |
| `POST /api/auth/login` | 10 req / 15 min per IP |
| `POST /api/auth/register` | 10 req / 15 min per IP |
| `POST /api/coverage-zones` | 20 req / hour per IP |

Rate-limit headers are returned as `RateLimit-*` (RFC 6585). When deploying behind a proxy set `trust proxy` to match your infrastructure — the server already sets `trust proxy: 1` for single-hop proxies (Railway, Render).

### HTTP security headers

[Helmet](https://helmetjs.github.io/) is applied globally and sets `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, and others.

### External API retries

All outbound HTTP calls (NOAA SPC, Nominatim, Tomorrow.io) use exponential back-off: 3 retries at 500 ms → 1 s → 2 s. Retries only fire on network errors or 5xx responses — 429 rate-limit responses are never retried.

### Other hardening

- JWT is verified on every authenticated request; tokens expire in 7 days (override with `JWT_EXPIRES_IN`)
- Request bodies are capped at 10 KB
- Passwords are validated server-side: 8–128 characters, bcrypt-hashed at cost 12
- Email format is validated on registration
- All DB queries use parameterized statements (no string interpolation)
- CORS is restricted to `FRONTEND_URL`

---

## Gmail OAuth2 setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project → enable the Gmail API
2. Create OAuth2 credentials (Web application), add `https://developers.google.com/oauthplayground` as an authorized redirect URI
3. Open [OAuth2 Playground](https://developers.google.com/oauthplayground/), enter your Client ID/Secret, authorize `https://mail.google.com/`, and exchange for a refresh token
4. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_USER` in `.env`

---

## Optional: Tomorrow.io forecasts

Set `TOMORROW_API_KEY` in `.env`. When present, an hourly cron job checks the 24-hour forecast for every active coverage zone and sends alerts for forecast hail, high winds, thunderstorms, heavy rain, snow, and ice.

Configurable thresholds:

| Variable | Default | Meaning |
|----------|---------|---------|
| `MIN_HAIL_PROBABILITY` | `40` | % probability to trigger a hail forecast alert |
| `MIN_WIND_SPEED` | `40` | mph gust to trigger a wind forecast alert |

---

## Optional: Twilio SMS

Fill in `TWILIO_*` variables in `.env`. The `sms_alerts` flag on each user profile controls SMS delivery alongside email.
