import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CoverageZoneForm from '../components/CoverageZoneForm';
import api from '../api/client';

export default function Settings() {
  const { user, setUser } = useAuth();

  const [profile,       setProfile]       = useState({ company_name: '', contact_name: '', phone: '', email_alerts: true, sms_alerts: false });
  const [zones,         setZones]         = useState([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ text: '', ok: true });
  const [deletingId,    setDeletingId]    = useState(null);

  // Seed form from user context
  useEffect(() => {
    if (user) {
      setProfile({
        company_name:  user.company_name  || '',
        contact_name:  user.contact_name  || '',
        phone:         user.phone         || '',
        email_alerts:  user.email_alerts  ?? true,
        sms_alerts:    user.sms_alerts    ?? false,
      });
    }
    api.get('/coverage-zones').then(r => setZones(r.data)).catch(() => {});
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ text: '', ok: true });
    try {
      const res = await api.put('/auth/profile', profile);
      setUser(res.data);
      setProfileMsg({ text: 'Saved!', ok: true });
      setTimeout(() => setProfileMsg({ text: '', ok: true }), 3000);
    } catch (err) {
      setProfileMsg({ text: err.response?.data?.error || 'Save failed', ok: false });
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteZone = async (id) => {
    if (!window.confirm('Remove this coverage zone?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/coverage-zones/${id}`);
      setZones(z => z.filter(z => z.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete zone');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 22 }}>Settings</h2>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Profile</h3>
        <form onSubmit={saveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div className="form-group">
              <label>Company Name</label>
              <input
                value={profile.company_name}
                onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Acme Roofing Co."
              />
            </div>
            <div className="form-group">
              <label>Contact Name</label>
              <input
                value={profile.contact_name}
                onChange={e => setProfile(p => ({ ...p, contact_name: e.target.value }))}
                placeholder="Jane Smith"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input value={user?.email || ''} disabled style={{ background: '#f8f9fb', color: '#888' }} />
          </div>

          <div className="form-group">
            <label>Phone (for SMS alerts)</label>
            <input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="+1 555 000 0000"
            />
          </div>

          {/* Alert Preferences */}
          <div style={{ background: '#f8f9fb', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#555' }}>ALERT PREFERENCES</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={profile.email_alerts}
                onChange={e => setProfile(p => ({ ...p, email_alerts: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Email Alerts</div>
                <div style={{ fontSize: 12, color: '#888' }}>Receive alerts at {user?.email}</div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profile.sms_alerts}
                onChange={e => setProfile(p => ({ ...p, sms_alerts: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>SMS Alerts <span style={{ color: '#aaa', fontWeight: 400, fontSize: 12 }}>(requires Twilio config)</span></div>
                <div style={{ fontSize: 12, color: '#888' }}>Text messages to {profile.phone || 'your phone number above'}</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
            {profileMsg.text && (
              <span style={{ fontSize: 13, color: profileMsg.ok ? '#27ae60' : '#c0392b' }}>
                {profileMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Coverage Zones ───────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Coverage Zones</h3>
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: 13 }}>
          You'll receive alerts when a qualifying storm lands within your zone radius.
        </p>

        {/* Add Zone Form */}
        <div style={{ background: '#f8f9fb', borderRadius: 6, padding: '16px', marginBottom: 20 }}>
          <CoverageZoneForm onCreated={zone => setZones(z => [zone, ...z])} />
        </div>

        {/* Zone List */}
        {zones.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No coverage zones yet. Add one above to start receiving alerts.
          </p>
        ) : (
          <div>
            {zones.map(zone => (
              <div
                key={zone.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{zone.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {zone.input_value} · {zone.radius_miles} mi radius
                    <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
                    {parseFloat(zone.center_lat).toFixed(4)}, {parseFloat(zone.center_lng).toFixed(4)}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteZone(zone.id)}
                  disabled={deletingId === zone.id}
                  style={{ flexShrink: 0 }}
                >
                  {deletingId === zone.id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
