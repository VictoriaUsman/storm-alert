import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Login() {
  const [mode,    setMode]    = useState('login');   // 'login' | 'register'
  const [form,    setForm]    = useState({ email: '', password: '', company_name: '', contact_name: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const { login } = useAuth();
  const navigate  = useNavigate();

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await api.post(endpoint, form);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <div style={{ fontSize: 40 }}>⚡</div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 700 }}>StormAlert</h1>
          <p style={{ margin: 0, opacity: .7, fontSize: 14 }}>Real-time storm alerts for your coverage area</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}>
          {/* Toggle */}
          <div style={{
            display: 'flex', borderRadius: 8, background: '#f4f6fa',
            padding: 4, marginBottom: 24,
          }}>
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '8px', border: 'none', borderRadius: 6,
                  cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  background: mode === m ? '#16213e' : 'transparent',
                  color:      mode === m ? '#fff' : '#888',
                  transition: 'all .15s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    placeholder="Acme Roofing Co."
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Your Name</label>
                  <input
                    placeholder="Jane Smith"
                    value={form.contact_name}
                    onChange={e => set('contact_name', e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Password {mode === 'register' && <span style={{ color: '#999', fontWeight: 400 }}>(min 8 characters)</span>}</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8, fontSize: 15 }}
              disabled={loading}
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 20 }}>
          Data sourced from NOAA Storm Prediction Center
        </p>
      </div>
    </div>
  );
}
