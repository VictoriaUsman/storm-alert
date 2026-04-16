import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

function ClientsTab() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/clients')
      .then(r => setClients(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Zones</th>
            <th>Alerts</th>
            <th>Email</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.company_name || '—'}</td>
              <td>{c.email}</td>
              <td>{c.phone || '—'}</td>
              <td>{c.zone_count}</td>
              <td>{c.alert_count}</td>
              <td>
                <span className={`badge badge-${c.email_alerts ? 'sent' : 'failed'}`}>
                  {c.email_alerts ? 'On' : 'Off'}
                </span>
              </td>
              <td style={{ color: '#888', fontSize: 12 }}>{formatDate(c.created_at)}</td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan="7" style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>No clients yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AlertsTab() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/alerts')
      .then(r => setAlerts(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Storm</th>
            <th>Channel</th>
            <th>Triggered By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(a => (
            <tr key={a.id}>
              <td style={{ fontSize: 12, color: '#888' }}>{formatDate(a.sent_at)}</td>
              <td>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.company_name || a.user_email}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{a.company_name ? a.user_email : ''}</div>
              </td>
              <td>
                {a.event_type ? (
                  <span>
                    <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                    {' '}{a.event_type} · {a.location_name || ''}{a.state ? `, ${a.state}` : ''}
                    <span style={{ display: 'block', fontSize: 11, color: '#aaa' }}>
                      {a.event_date ? new Date(a.event_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}
                    </span>
                  </span>
                ) : <span style={{ color: '#aaa' }}>—</span>}
              </td>
              <td style={{ textTransform: 'capitalize' }}>{a.channel}</td>
              <td style={{ textTransform: 'capitalize', color: '#888', fontSize: 13 }}>{a.triggered_by}</td>
              <td>
                <span className={`badge badge-${a.status === 'sent' ? 'sent' : 'failed'}`}>
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr><td colSpan="6" style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>No alerts sent yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StormEventsTab() {
  const [storms,   setStorms]   = useState([]);
  const [clients,  setClients]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState({});
  const [days,     setDays]     = useState(7);
  const [msg,      setMsg]      = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/storms?days=${days}`),
      api.get('/admin/clients'),
    ]).then(([sr, cr]) => {
      setStorms(sr.data);
      setClients(cr.data);
    }).finally(() => setLoading(false));
  }, [days]);

  const sendToAll = async (stormId) => {
    setSending(s => ({ ...s, [stormId]: 'all' }));
    try {
      const res = await api.post('/admin/send-alert', { storm_id: stormId });
      setMsg(`Sent ${res.data.alerts_sent} alert(s)`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed');
    } finally {
      setSending(s => ({ ...s, [stormId]: null }));
      setTimeout(() => setMsg(''), 4000);
    }
  };

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Show:</label>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '5px 10px', borderRadius: 5, border: '1.5px solid #d0d5dd', fontSize: 13 }}
        >
          {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        {msg && <span style={{ fontSize: 13, color: '#27ae60', fontWeight: 600 }}>{msg}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Size / Speed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {storms.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 12, color: '#888' }}>
                  {new Date(s.event_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </td>
                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.event_type}</td>
                <td><span className={`badge badge-${s.severity}`}>{s.severity}</span></td>
                <td style={{ fontSize: 13 }}>
                  {[s.location_name, s.county, s.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td style={{ fontWeight: 600 }}>
                  {s.hail_size  && `${s.hail_size}"`}
                  {s.wind_speed && `${s.wind_speed} mph`}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => sendToAll(s.id)}
                    disabled={!!sending[s.id]}
                    title="Send to all clients whose coverage zone includes this storm"
                  >
                    {sending[s.id] ? 'Sending…' : '📧 Alert All'}
                  </button>
                </td>
              </tr>
            ))}
            {storms.length === 0 && (
              <tr><td colSpan="6" style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>No storms in range</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  const [tab,         setTab]         = useState('clients');
  const [checkStatus, setCheckStatus] = useState('');
  const [checking,    setChecking]    = useState(false);

  const runCheck = async () => {
    setChecking(true);
    setCheckStatus('');
    try {
      const res = await api.post('/admin/run-check', { days_back: 2 });
      setCheckStatus(`✓ Fetched ${res.data.storms_fetched} events, ${res.data.new_storms} new, ${res.data.alerts_sent} alerts sent`);
    } catch (err) {
      setCheckStatus('✗ ' + (err.response?.data?.error || 'Check failed'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Admin Dashboard</h2>
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-success" onClick={runCheck} disabled={checking}>
            {checking ? '⟳ Checking…' : '⟳ Run Storm Check'}
          </button>
          {checkStatus && (
            <div style={{
              marginTop: 8, fontSize: 13,
              color: checkStatus.startsWith('✓') ? '#27ae60' : '#c0392b',
            }}>
              {checkStatus}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tabs" style={{ padding: '0 20px', margin: 0 }}>
          {[
            { id: 'clients',  label: 'Clients' },
            { id: 'alerts',   label: 'Alert Log' },
            { id: 'storms',   label: 'Storm Events' },
          ].map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 20 }}>
          {tab === 'clients' && <ClientsTab />}
          {tab === 'alerts'  && <AlertsTab />}
          {tab === 'storms'  && <StormEventsTab />}
        </div>
      </div>
    </div>
  );
}
