import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import api from '../api/client';

// Fix default Leaflet marker icon path issue with bundlers
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEVERITY_COLOR = {
  light:    '#e6a817',
  moderate: '#d4600a',
  severe:   '#c0392b',
};

const SEVERITY_RADIUS = { light: 6, moderate: 8, severe: 10 };

function StormPopup({ storm }) {
  const loc = [storm.location_name, storm.county, storm.state].filter(Boolean).join(', ');
  const date = new Date(storm.event_date + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  return (
    <div style={{ fontSize: 13, minWidth: 160 }}>
      <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'capitalize' }}>
        {storm.severity} {storm.event_type}
      </div>
      <div style={{ color: '#555' }}>{loc || '—'}</div>
      <div style={{ color: '#555' }}>{date}</div>
      {storm.hail_size  && <div style={{ marginTop: 4 }}>Hail: <strong>{storm.hail_size}"</strong></div>}
      {storm.wind_speed && <div style={{ marginTop: 4 }}>Wind: <strong>{storm.wind_speed} mph</strong></div>}
    </div>
  );
}

// Fly to a specific storm when stormId prop changes
function FlyToStorm({ storms, stormId }) {
  const map = useMap();
  useEffect(() => {
    if (!stormId) return;
    const target = storms.find(s => s.id === stormId);
    if (target) map.flyTo([target.lat, target.lng], 9, { duration: 1 });
  }, [stormId, storms, map]);
  return null;
}

export default function StormMap({ coverageZones = [], stormId = null }) {
  const [storms,  setStorms]  = useState([]);
  const [days,    setDays]    = useState(7);
  const [loading, setLoading] = useState(true);
  const [counts,  setCounts]  = useState({ light: 0, moderate: 0, severe: 0 });

  useEffect(() => {
    setLoading(true);
    api.get(`/storms?days=${days}`)
      .then(res => {
        setStorms(res.data);
        const c = { light: 0, moderate: 0, severe: 0 };
        res.data.forEach(s => { if (c[s.severity] !== undefined) c[s.severity]++; });
        setCounts(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Controls overlay */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        background: 'rgba(255,255,255,.95)', borderRadius: 8,
        padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.15)',
        fontSize: 13,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#16213e' }}>Storm Events</div>

        {/* Days filter */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Show last</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
          >
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>

        {/* Legend */}
        <div style={{ fontSize: 12, color: '#555' }}>
          {['severe', 'moderate', 'light'].map(sev => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', width: 12, height: 12,
                borderRadius: '50%', background: SEVERITY_COLOR[sev],
              }} />
              <span style={{ textTransform: 'capitalize' }}>{sev}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{counts[sev]}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #eee', marginTop: 6, paddingTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              borderRadius: '50%', background: 'rgba(0,100,200,.15)',
              border: '2px solid #0064c8',
            }} />
            Coverage zones
          </div>
        </div>

        {loading && <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>Loading…</div>}
      </div>

      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        <FlyToStorm storms={storms} stormId={stormId} />

        {/* Coverage Zones */}
        {coverageZones.map(zone => (
          <Circle
            key={zone.id}
            center={[parseFloat(zone.center_lat), parseFloat(zone.center_lng)]}
            radius={parseFloat(zone.radius_miles) * 1609.34}
            pathOptions={{ color: '#0064c8', fillColor: '#0064c8', fillOpacity: 0.1, weight: 2 }}
          >
            <Popup>
              <strong>{zone.name}</strong>
              <br />{zone.input_value} · {zone.radius_miles} mi radius
            </Popup>
          </Circle>
        ))}

        {/* Storm Events */}
        {storms.map(storm => (
          <CircleMarker
            key={storm.id}
            center={[parseFloat(storm.lat), parseFloat(storm.lng)]}
            radius={SEVERITY_RADIUS[storm.severity] || 7}
            pathOptions={{
              color:       SEVERITY_COLOR[storm.severity],
              fillColor:   SEVERITY_COLOR[storm.severity],
              fillOpacity: 0.75,
              weight:      1.5,
            }}
          >
            <Popup><StormPopup storm={storm} /></Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
