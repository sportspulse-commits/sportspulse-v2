'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useEffect } from 'react';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(function() {
    supabase.auth.getSession().then(function({ data: { session } }) {
      if (session) window.location.href = '/';
    });
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setSuccess('');
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } }
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSuccess('Account created! Redirecting...');
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      window.location.href = '/';
    }
    setLoading(false);
  }

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ width: '380px', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href='/' style={{ fontSize: '22px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '2px', textDecoration: 'none', display: 'block' }}>SPORTSPULSE</a>
          <div style={{ fontSize: '11px', color: '#475569', letterSpacing: '2px', marginTop: '4px' }}>PREDICTION MARKET ANALYTICS</div>
        </div>
        <div style={{ display: 'flex', marginBottom: '24px', border: '1px solid #1e3a5f', borderRadius: '4px', overflow: 'hidden' }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{ flex: 1, padding: '8px', background: mode === m ? '#22c55e' : 'transparent', color: mode === m ? '#000' : '#475569', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>
        {mode === 'signup' && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '1px', marginBottom: '4px' }}>DISPLAY NAME</div>
            <input type='text' value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder='Your name'
              style={{ width: '100%', padding: '10px', background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' as const }} />
          </div>
        )}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '1px', marginBottom: '4px' }}>EMAIL</div>
          <input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder='you@example.com'
            style={{ width: '100%', padding: '10px', background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '1px', marginBottom: '4px' }}>PASSWORD</div>
          <input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder='........'
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            style={{ width: '100%', padding: '10px', background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' as const }} />
        </div>
        {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px', padding: '8px', background: '#1a0a0a', borderRadius: '4px', border: '1px solid #7f1d1d' }}>{error}</div>}
        {success && <div style={{ color: '#22c55e', fontSize: '12px', marginBottom: '12px', padding: '8px', background: '#0a1a0a', borderRadius: '4px', border: '1px solid #14532d' }}>{success}</div>}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '12px', background: loading ? '#1e3a5f' : '#22c55e', border: 'none', borderRadius: '4px', color: loading ? '#475569' : '#000', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase' as const }}>
          {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
        </button>
      </div>
    </main>
  );
}