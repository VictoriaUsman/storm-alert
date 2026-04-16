import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINK = {
  textDecoration: 'none',
  color: '#aac4e8',
  fontWeight: 600,
  fontSize: 14,
  padding: '6px 14px',
  borderRadius: 5,
  transition: 'background .15s, color .15s',
};
const ACTIVE = { ...LINK, background: 'rgba(255,255,255,.12)', color: '#fff' };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: '#16213e',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      height: 52,
      gap: 8,
      boxShadow: '0 2px 6px rgba(0,0,0,.2)',
    }}>
      {/* Logo */}
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginRight: 16 }}>
        ⚡ StormAlert
      </span>

      <NavLink to="/dashboard" style={({ isActive }) => isActive ? ACTIVE : LINK}>
        Map
      </NavLink>
      <NavLink to="/settings"  style={({ isActive }) => isActive ? ACTIVE : LINK}>
        Settings
      </NavLink>
      {user?.role === 'admin' && (
        <NavLink to="/admin" style={({ isActive }) => isActive ? ACTIVE : LINK}>
          Admin
        </NavLink>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <span style={{ color: '#aac4e8', fontSize: 13 }}>
        {user?.company_name || user?.email}
      </span>
      <button
        onClick={handleLogout}
        style={{ ...LINK, background: 'transparent', border: '1px solid #aac4e8', cursor: 'pointer' }}
      >
        Sign out
      </button>
    </nav>
  );
}
