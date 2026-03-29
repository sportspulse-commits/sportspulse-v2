'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
export default function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);
  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }
  const circleStyle: React.CSSProperties = {
    width: '36px', height: '36px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace', fontWeight: 'bold', cursor: 'pointer',
    flexShrink: 0,
  };
  if (!user) {
    return (
      <a href='/auth' style={{ ...circleStyle, border: '2px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '8px', letterSpacing: '0.5px', textDecoration: 'none' }}>
        LOGIN
      </a>
    );
  }
  const initials = (user.user_metadata?.full_name || user.email || 'U').slice(0, 2).toUpperCase();
  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...circleStyle, background: '#22c55e', border: 'none', color: '#000', fontSize: '12px' }}>
        {initials}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '44px', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '8px', minWidth: '180px', zIndex: 9999 }}>
          <div style={{ fontSize: '10px', color: '#475569', padding: '4px 8px', marginBottom: '4px', borderBottom: '1px solid #1e3a5f', paddingBottom: '8px' }}>{user.email}</div>
          <a href='/analytics' onClick={() => setOpen(false)} style={{ display: 'block', width: '100%', padding: '6px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', textDecoration: 'none', letterSpacing: '1px' }}>
            📊 ANALYTICS
          </a>
          <button onClick={handleSignOut} style={{ width: '100%', padding: '6px 8px', background: 'none', border: 'none', color: '#f87171', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', textAlign: 'left', letterSpacing: '1px' }}>
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  );
}