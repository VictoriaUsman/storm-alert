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
- An SMTP-capable email account (Gmail app password, SendGrid SMTP, etc.)

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
| `JWT_SECRET` | Any long random string (32+ chars) |
| `ADMIN_EMAIL` | The email you'll register with first — it gets the admin role |
| `SMTP_HOST/PORT/USER/PASS` | Your SMTP credentials |
| `EMAIL_FROM` | Sender name + address |

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
MVP/
├── backend/
│   ├── src/
│   │   ├── db/           schema.sql, pool setup
│   │   ├── middleware/   JWT auth
│   │   ├── routes/       auth, coverage-zones, storms, admin
│   │   ├── services/     noaaService, geocodeService, alertService
│   │   └── jobs/         stormChecker (cron)
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/        Login, Dashboard, Settings, Admin
        ├── components/   Navbar, StormMap, CoverageZoneForm
        ├── context/      AuthContext
        └── api/          axios client
```

## Optional: Twilio SMS

Fill in `TWILIO_*` variables in `.env`. The `sms_alerts` flag on each user will then control SMS delivery alongside email.
