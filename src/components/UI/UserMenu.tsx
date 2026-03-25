'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }

  if (!user) {
    return (
      <a href='/auth'
        style={{ padding: '5px 12px', borderRadius: '4px', border: '1px solid #22c55e', background: 'transparent', color: '#22c55e', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px', textDecoration: 'none', display: 'inline-block' }}>
        LOG IN
      </a>
    );
  }

  const initials = (user.user_metadata?.full_name || user.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#22c55e', border: 'none', color: '#000', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace' }}>
        {initials}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '36px', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '8px', minWidth: '160px', zIndex: 9999 }}>
          <div style={{ fontSize: '10px', color: '#475569', padding: '4px 8px', marginBottom: '4px', borderBottom: '1px solid #1e3a5f', paddingBottom: '8px' }}>{user.email}</div>
          <button onClick={handleSignOut}
            style={{ width: '100%', padding: '6px 8px', background: 'none', border: 'none', color: '#f87171', fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer', textAlign: 'left' as const, letterSpacing: '1px' }}>
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  );
}