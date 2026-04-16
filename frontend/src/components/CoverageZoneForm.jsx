import React, { useState } from 'react';
import api from '../api/client';

export default function CoverageZoneForm({ onCreated }) {
  const [form,    setForm]    = useState({ name: '', input_value: '', radius_miles: 25 });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/coverage-zones', form);
      setForm({ name: '', input_value: '', radius_miles: 25 });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add zone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Zone Name</label>
          <input
            placeholder="e.g. Dallas Office"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Location (zip code or city, state)</label>
          <input
            placeholder="e.g. 75201 or Dallas, TX"
            value={form.input_value}
            onChange={e => set('input_value', e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Radius (miles)</label>
          <input
            type="number"
            min="1"
            max="500"
            value={form.radius_miles}
            onChange={e => set('radius_miles', e.target.value)}
            style={{ width: 90 }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ height: 38, alignSelf: 'end' }}
        >
          {loading ? 'Adding…' : '+ Add Zone'}
        </button>
      </div>

      {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}
    </form>
  );
}
