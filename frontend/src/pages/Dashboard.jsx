import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StormMap from '../components/StormMap';
import api from '../api/client';

const SEV_COLOR = { light: '#e6a817', moderate: '#d4600a', severe: '#c0392b' };

function StormListItem({ storm, active, onClick }) {
  const loc  = [storm.location_name, storm.state].filter(Boolean).join(', ');
  const date = new Date(storm.event_date + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const detail = storm.event_type === 'hail'
    ? `${storm.hail_size}"`
    : `${storm.wind_speed} mph`;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px', cursor: 'pointer', borderRadius: 6,
        background: active ? '#f0f4ff' : 'transparent',
        borderLeft: `3px solid ${active ? SEV_COLOR[storm.severity] : 'transparent'}`,
        transition: 'background .1s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{
        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
        background: SEV_COLOR[storm.severity],
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>
          {storm.severity} {storm.event_type} · {detail}
        </div>
        <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {loc || 'Unknown'} · {date}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [zones,    setZones]    = useState([]);
  const [storms,   setStorms]   = useState([]);
  const [days,     setDays]     = useState(7);
  const [activeId, setActiveId] = useState(searchParams.get('storm'));
  const [showZones, setShowZones] = useState(true);

  useEffect(() => {
    api.get('/coverage-zones').then(r => setZones(r.data)).catch(() => {});
    api.get(`/storms?days=${days}`).then(r => setStorms(r.data)).catch(() => {});
  }, [days]);

  useEffect(() => {
    const id = searchParams.get('storm');
    if (id) setActiveId(id);
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <StormMap
          coverageZones={showZones ? zones : []}
          stormId={activeId}
        />
      </div>

      {/* Sidebar */}
      <div style={{
        width: 280, background: '#fff', borderLeft: '1px solid #e8e8e8',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Storms</h3>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
            >
              {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </div>

          {/* Coverage zone toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showZones}
              onChange={e => setShowZones(e.target.checked)}
            />
            Show my coverage zones
          </label>
        </div>

        {/* Summary counts */}
        <div style={{ padding: '8px 14px', background: '#f8f9fb', borderBottom: '1px solid #eee', display: 'flex', gap: 12 }}>
          {['severe', 'moderate', 'light'].map(sev => {
            const count = storms.filter(s => s.severity === sev).length;
            return (
              <div key={sev} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: SEV_COLOR[sev] }}>{count}</div>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{sev}</div>
              </div>
            );
          })}
          <div style={{ textAlign: 'center', marginLeft: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#16213e' }}>{storms.length}</div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Total</div>
          </div>
        </div>

        {/* Storm list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {storms.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              No storms in the last {days} days
            </div>
          ) : (
            storms.map(s => (
              <StormListItem
                key={s.id}
                storm={s}
                active={s.id === activeId}
                onClick={() => setActiveId(s.id === activeId ? null : s.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {zones.length === 0 && (
          <div style={{
            padding: '12px 14px', background: '#fffbea',
            borderTop: '1px solid #ffe58f', fontSize: 12, color: '#7d6608',
          }}>
            ⚠ You have no coverage zones. <a href="/settings" style={{ color: '#16213e', fontWeight: 600 }}>Add one →</a>
          </div>
        )}
      </div>
    </div>
  );
}
