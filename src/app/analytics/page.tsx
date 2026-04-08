'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '16px 20px', flex: 1, minWidth: '120px' }}>
      <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ color: color || '#e2e8f0', fontSize: '26px', fontWeight: 'bold', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function AuthPrompt() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '40px', width: '360px', textAlign: 'center' as const }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>{'🔒'}</div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px', letterSpacing: '1px', fontFamily: 'monospace' }}>LOG IN TO VIEW ANALYTICS</div>
        <div style={{ color: '#475569', fontSize: '12px', marginBottom: '24px', fontFamily: 'monospace' }}>Track your win rate, ROI, and P&L over time.</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href='/auth' style={{ flex: 1, display: 'block', padding: '10px', background: '#22c55e', color: '#000', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', textDecoration: 'none', textAlign: 'center' as const }}>LOG IN</a>
          <a href='/auth' style={{ flex: 1, display: 'block', padding: '10px', background: 'transparent', color: '#22c55e', border: '1px solid #22c55e', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', textDecoration: 'none', textAlign: 'center' as const }}>SIGN UP</a>
        </div>
      </div>
    </div>
  );
}

import { normalizeBet } from '@/lib/normalize';

function computeStats(bets: any[]) {
  const normalized = bets.map(normalizeBet);
  const settled = normalized.filter(function(b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
  const won = settled.filter(function(b) { return b.status === 'won'; });
  const lost = settled.filter(function(b) { return b.status === 'lost'; });
  const push = settled.filter(function(b) { return b.status === 'push'; });
  const noPush = settled.filter(function(b) { return b.status !== 'push'; });
  const totalStaked = settled.reduce(function(s, b) { return s + b.stake; }, 0);
  const pnl = settled.reduce(function(s, b) { return s + b.net_profit; }, 0);
  const roi = totalStaked > 0 ? Math.round((pnl / totalStaked) * 1000) / 10 : 0;
  const winRate = noPush.length > 0 ? Math.round((won.length / noPush.length) * 1000) / 10 : 0;
  let streak = 0; let streakType = '';
  for (const b of [...settled].reverse()) {
    if (b.status === 'push') continue;
    if (streak === 0) { streakType = b.status; streak = 1; }
    else if (b.status === streakType) { streak++; }
    else { break; }
  }
  return { winRate, roi, pnl: Math.round(pnl * 100) / 100, totalStaked: Math.round(totalStaked * 100) / 100, wonBets: won.length, lostBets: lost.length, pushBets: push.length, settledBets: settled.length, pendingBets: normalized.filter(function(b) { return b.status === 'open' || b.status === 'pending'; }).length, streak, streakType };
}

function computeChartData(bets: any[]) {
  // Sort RAW bets chronologically (oldest first) by settled_at
  const sortedRaw = [...bets].sort(function(a, b) {
    const da = a.settled_at || a.created_at || a.game_date || a.createdAt || a.date || '';
    const db = b.settled_at || b.created_at || b.game_date || b.createdAt || b.date || '';
    return da.localeCompare(db);
  });
  const normalized = sortedRaw.map(normalizeBet);
  const settled = normalized.filter(function(b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
  let r = 0;
  return settled.map(function(b, idx) {
    r += b.net_profit;
    return { idx: idx + 1, date: b.date, pnl: Math.round(r * 100) / 100, gain: Math.round(b.net_profit * 100) / 100, game: b.game, pick: b.pick, odds: b.odds || 0, stake: b.stake, result: b.status };
  });
}

function computeRecentBets(bets: any[], limit = 50) {
  const sortedRaw = [...bets].sort(function(a, b) {
    const da = a.settled_at || a.created_at || a.game_date || a.createdAt || a.date || '';
    const db = b.settled_at || b.created_at || b.game_date || b.createdAt || b.date || '';
    return db.localeCompare(da);
  });
  const normalized = sortedRaw.map(normalizeBet);
  const settled = normalized.filter(function(b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
  return settled.slice(0, limit).map(function(b) {
    const rawSettledAt = b.settled_at || b.created_at || b.game_date || b.createdAt || b.date || '';
    return { id: b.id || Math.random().toString(), date: b.date, settledAt: rawSettledAt, game: b.game, pick: b.pick, odds: b.odds || 0, stake: b.stake, status: b.status, pnl: Math.round(b.net_profit * 100) / 100 };
  });
}

function BetRow({ bet, selectedArchive, onSaved, onDeleted }: { bet: any; selectedArchive: any; onSaved: () => void; onDeleted: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [odds, setOdds] = useState(String(bet.odds));
  const [stake, setStake] = useState(String(bet.stake));
  const [status, setStatus] = useState(bet.status);

  const rc = bet.status === 'won' ? '#0d2a1a' : bet.status === 'lost' ? '#2a0d0d' : 'transparent';
  const pc = bet.pnl > 0 ? '#22c55e' : bet.pnl < 0 ? '#ef4444' : '#475569';
  const inputStyle = { background: '#0a0e1a', border: '1px solid #1e3a5f', color: '#e2e8f0', borderRadius: '3px', padding: '2px 4px', fontSize: '11px', width: '100%', fontFamily: 'monospace' };

  async function handleSave() {
    if (!bet.id) return;
    setIsSaving(true);
    try {
      const newStake = Number(stake);
      const newOdds = Number(odds);
      const newStatus = status;
      let payout = 0;
      if (newStatus === 'won') {
        const profit = newOdds > 0 ? newStake * (newOdds / 100) : newStake * (100 / Math.abs(newOdds));
        payout = newStake + profit;
      } else if (newStatus === 'push') {
        payout = newStake;
      }
      const { error } = await supabase.from('bets').update({ odds: newOdds, stake: newStake, status: newStatus, payout }).eq('id', bet.id);
      if (!error) { setIsEditing(false); onSaved(); }
      else console.error('Save error:', error);
    } catch(e) { console.error(e); }
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!bet.id || !confirm('Delete this bet?')) return;
    await supabase.from('bets').delete().eq('id', bet.id);
    onDeleted();
  }

  return (
    <tr style={{ background: isEditing ? '#0f1629' : rc, borderBottom: '1px solid #1e3a5f' }}>
      <td style={{ padding: '8px', color: '#475569', fontSize: '10px', whiteSpace: 'nowrap' as const }}>{bet.settledAt ? new Date(bet.settledAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : bet.date}</td>
      <td style={{ padding: '8px', color: '#94a3b8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{bet.game}</td>
      <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 'bold' }}>{bet.pick}</td>
      <td style={{ padding: '4px 8px', minWidth: '60px' }}>{isEditing ? <input style={inputStyle} value={odds} onChange={function(e) { setOdds(e.target.value); }} /> : <span style={{ color: '#94a3b8' }}>{bet.odds > 0 ? '+' + bet.odds : bet.odds}</span>}</td>
      <td style={{ padding: '4px 8px', minWidth: '70px' }}>{isEditing ? <input style={inputStyle} value={stake} onChange={function(e) { setStake(e.target.value); }} /> : <span style={{ color: '#94a3b8' }}>{'$' + Number(bet.stake).toFixed(2)}</span>}</td>
      <td style={{ padding: '4px 8px', minWidth: '80px' }}>{isEditing ? <select style={{...inputStyle, width: 'auto'}} value={status} onChange={function(e) { setStatus(e.target.value); }}><option value="won">WON</option><option value="lost">LOST</option><option value="push">PUSH</option></select> : <span style={{ color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#475569', fontWeight: 'bold', textTransform: 'uppercase' as const }}>{bet.status}</span>}</td>
      <td style={{ padding: '8px', color: pc, fontWeight: 'bold' }}>{bet.pnl >= 0 ? '+$' : '-$'}{Math.abs(bet.pnl).toFixed(2)}</td>
      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' as const }}>{!selectedArchive && (isEditing ? <span style={{ display: 'flex', gap: '4px' }}><button onClick={handleSave} disabled={isSaving} style={{ padding: '3px 8px', background: '#22c55e', border: 'none', color: '#000', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{isSaving ? '...' : 'SAVE'}</button><button onClick={function() { setIsEditing(false); setOdds(String(bet.odds)); setStake(String(bet.stake)); setStatus(bet.status); }} style={{ padding: '3px 6px', background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>✕</button></span> : <span style={{ display: 'flex', gap: '4px' }}><button onClick={function() { setIsEditing(true); }} style={{ padding: '3px 6px', background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>✎</button><button onClick={handleDelete} style={{ padding: '3px 6px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}>✕</button></span>)}</td>
    </tr>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'alltime'>('current');
  const [archives, setArchives] = useState<any[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const editFormRef = useRef<any>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(function() {
    supabase.auth.getSession().then(async function({ data: { session } }) {
      if (!session) { setLoggedIn(false); setLoading(false); return; }
      setLoggedIn(true);
      const res = await fetch('/api/analytics', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const json = await res.json();
      setData(json);
      setLoading(false);
    });
  }, []);

  useEffect(function() {
    try { const a = JSON.parse(localStorage.getItem('sportspulse_archives_v2') || '[]'); setArchives(a); } catch {}
  }, []);

  const allArchiveBets = archives.flatMap(function(a: any) { return a.bets || []; });
  const currentBetsRaw = (data?.recentBets || []).map(function(b: any) { return { ...b, net_profit: b.pnl, bet_pick: b.pick, settled_at: b.date }; });

  const s = selectedArchive ? computeStats(selectedArchive.bets || []) : viewMode === 'alltime' ? { ...computeStats([...allArchiveBets, ...currentBetsRaw]), streak: data?.summary?.streak, streakType: data?.summary?.streakType } : data?.summary;
  const recentBets = selectedArchive ? computeRecentBets(selectedArchive.bets || []) : (data?.recentBets || []);
  const chartData = (function() { const src = [...recentBets].reverse(); let r = 0; return src.map(function(b: any, idx: number) { r += b.pnl; return { idx: idx + 1, date: b.date, pnl: Math.round(r * 100) / 100, gain: b.pnl, game: b.game, pick: b.pick, odds: b.odds || 0, stake: b.stake, result: b.status }; }); })();

  const leagueData = (selectedArchive || viewMode === 'alltime') ? (function() {
    const src = selectedArchive ? (selectedArchive.bets || []) : [...allArchiveBets, ...currentBetsRaw];
    const norm = src.map(normalizeBet).filter(function(b: any) { return b.status !== 'open' && b.status !== 'pending'; });
    const leagues = [...new Set(norm.map(function(b: any) { return b.league; }))].filter(Boolean) as string[];
    return leagues.map(function(league: string) {
      const lb = norm.filter(function(b: any) { return b.league === league; });
      const lnp = lb.filter(function(b: any) { return b.status !== 'push'; });
      const lw = lb.filter(function(b: any) { return b.status === 'won'; });
      return { league, winRate: lnp.length > 0 ? Math.round(lw.length / lnp.length * 100) : 0 };
    }).sort(function(a: any, b: any) { return b.winRate !== a.winRate ? b.winRate - a.winRate : a.league.localeCompare(b.league); });
  })() : (data?.byLeague || []).slice().sort(function(a: any, b: any) { return b.winRate !== a.winRate ? b.winRate - a.winRate : a.league.localeCompare(b.league); });

  const typeData = (selectedArchive || viewMode === 'alltime') ? (function() {
    const src = selectedArchive ? (selectedArchive.bets || []) : [...allArchiveBets, ...currentBetsRaw];
    const norm = src.map(normalizeBet).filter(function(b: any) { return b.status !== 'open' && b.status !== 'pending'; });
    const types = [...new Set(norm.map(function(b: any) { return b.betType; }))].filter(Boolean) as string[];
    return types.map(function(type: string) {
      const tb = norm.filter(function(b: any) { return b.betType === type; });
      const tnp = tb.filter(function(b: any) { return b.status !== 'push'; });
      const tw = tb.filter(function(b: any) { return b.status === 'won'; });
      return { type, winRate: tnp.length > 0 ? Math.round(tw.length / tnp.length * 100) : 0 };
    }).sort(function(a: any, b: any) { return b.winRate !== a.winRate ? b.winRate - a.winRate : a.type.localeCompare(b.type); });
  })() : (data?.byBetType || []).slice().sort(function(a: any, b: any) { return b.winRate !== a.winRate ? b.winRate - a.winRate : a.type.localeCompare(b.type); });

  const pnlColor = s?.pnl >= 0 ? '#22c55e' : '#ef4444';
  const roiColor = s?.roi >= 0 ? '#22c55e' : '#ef4444';
  const streakLabel = s?.streak > 0 ? (s.streakType === 'won' ? '🔥 ' + s.streak + 'W' : '❄️ ' + s.streak + 'L') : '-';

  function archiveStats(ab: any[]) {
    const norm = ab.map(normalizeBet).filter(function(b: any) { return b.status !== 'open' && b.status !== 'pending'; });
    const won = norm.filter(function(b) { return b.status === 'won'; });
    const lost = norm.filter(function(b) { return b.status === 'lost'; });
    const noPush = norm.filter(function(b) { return b.status !== 'push'; });
    const pnl = norm.reduce(function(s: number, b: any) { return s + b.net_profit; }, 0);
    return { pnl: Math.round(pnl * 100) / 100, wr: noPush.length > 0 ? Math.round(won.length / noPush.length * 100) : 0, won: won.length, lost: lost.length };
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e2e8f0', fontFamily: 'monospace', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <a href='/' style={{ fontSize: '11px', color: '#22c55e', letterSpacing: '3px', marginBottom: '2px', textDecoration: 'none', display: 'block' }}>SPORTSPULSE</a>
            <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>{selectedArchive ? selectedArchive.title.toUpperCase() : 'ANALYTICS'}</div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>{selectedArchive ? 'Archived split · ' + new Date(selectedArchive.createdAt).toLocaleDateString() : 'Your betting performance'}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedArchive && <button onClick={() => setSelectedArchive(null)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1px' }}>← BACK TO CURRENT</button>}
            {!selectedArchive && loggedIn && data && <button onClick={() => setViewMode(v => v === 'current' ? 'alltime' : 'current')} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1e3a5f', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1px' }}>{viewMode === 'current' ? 'ALL TIME' : 'CURRENT'}</button>}
            <a href='/' style={{ color: '#475569', fontSize: '11px', textDecoration: 'none', border: '1px solid #1e3a5f', padding: '6px 12px', borderRadius: '4px', letterSpacing: '1px' }}>← BACK</a>
          </div>
        </div>
        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '64px' }}>Loading analytics...</div>}
        {!loading && loggedIn === false && <AuthPrompt />}
        {!loading && loggedIn && data && s && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
                <StatCard label='Win Rate' value={s.winRate + '%'} sub={s.wonBets + 'W - ' + s.lostBets + 'L' + (s.pushBets > 0 ? ' - ' + s.pushBets + 'P' : '')} color={s.winRate >= 50 ? '#22c55e' : '#f87171'} />
                <StatCard label='ROI' value={(s.roi >= 0 ? '+' : '') + s.roi + '%'} sub={'on $' + s.totalStaked + ' staked'} color={roiColor} />
                <StatCard label='Total P&L' value={(s.pnl >= 0 ? '+$' : '-$') + Math.abs(s.pnl).toFixed(2)} sub={s.settledBets + ' settled bets'} color={pnlColor} />
                <StatCard label='Streak' value={streakLabel} sub={s.pendingBets + ' pending'} />
              </div>
              {chartData.length > 1 && (
                <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>P&L OVER TIME</div>
                  <ResponsiveContainer width='100%' height={200}>
                    <LineChart data={chartData}>
                      <defs><linearGradient id='pnlGradient' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stopColor='#22c55e' /><stop offset='100%' stopColor='#ef4444' /></linearGradient></defs>
                      <XAxis dataKey='idx' tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={function(v: any) { const pt = chartData[v - 1]; return pt && pt.date ? pt.date.slice(5) : ''; }} interval={Math.max(0, Math.floor(chartData.length / 5))} />
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                      <Tooltip content={function(props: any) { if (!props.active || !props.payload || !props.payload.length) return null; const pt = props.payload[0].payload; const color = pt.result === 'won' ? '#22c55e' : pt.result === 'lost' ? '#ef4444' : '#475569'; return (<div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', minWidth: '180px' }}><div style={{ color: '#475569', fontSize: '10px', marginBottom: '6px' }}>{pt.date} - Bet #{pt.idx}</div><div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '2px' }}>{pt.pick || '-'}</div><div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '6px' }}>{pt.game}</div><div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}><span style={{ color: '#475569' }}>Odds</span><span style={{ color: '#e2e8f0' }}>{pt.odds > 0 ? '+' + pt.odds : pt.odds}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}><span style={{ color: '#475569' }}>Stake</span><span style={{ color: '#e2e8f0' }}>{'$' + Number(pt.stake).toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #1e3a5f' }}><span style={{ color, fontWeight: 'bold', textTransform: 'uppercase' as const }}>{pt.result}</span><span style={{ color, fontWeight: 'bold' }}>{pt.gain >= 0 ? '+$' : '-$'}{Math.abs(pt.gain).toFixed(2)}</span></div></div>); }} cursor={{ stroke: '#1e3a5f', strokeWidth: 1 }} />
                      <ReferenceLine y={0} stroke='#475569' strokeDasharray='4 2' strokeWidth={1} />
                      <Line type='monotone' dataKey='pnl' stroke='url(#pnlGradient)' strokeWidth={2} isAnimationActive={false} dot={false} activeDot={{ r: 5, fill: '#22c55e', stroke: '#0f1629', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {chartData.length <= 1 && <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', marginBottom: '20px', textAlign: 'center' as const, color: '#475569', fontSize: '12px' }}>Settle more bets to see your P&L chart</div>}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
                {leagueData.length > 0 && (<div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', flex: 1, minWidth: '280px' }}><div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>WIN RATE BY LEAGUE</div><ResponsiveContainer width='100%' height={160}><BarChart data={leagueData} layout='vertical'><XAxis type='number' domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} /><YAxis type='category' dataKey='league' tick={{ fill: '#94a3b8', fontSize: 10 }} width={50} /><Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0', borderRadius: '4px' }} itemStyle={{ color: '#22c55e' }} labelStyle={{ color: '#94a3b8' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={function(v: any) { return [v + '%', 'Win Rate']; }} /><Bar dataKey='winRate' radius={2} minPointSize={4}>{leagueData.map(function(_: any, i: number) { return <Cell key={i} fill='#22c55e' />; })}</Bar></BarChart></ResponsiveContainer></div>)}
                {typeData.length > 0 && (<div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', flex: 1, minWidth: '280px' }}><div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>WIN RATE BY BET TYPE</div><ResponsiveContainer width='100%' height={160}><BarChart data={typeData} layout='vertical'><XAxis type='number' domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} /><YAxis type='category' dataKey='type' tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} /><Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', fontFamily: 'monospace', fontSize: '11px', color: '#e2e8f0', borderRadius: '4px' }} itemStyle={{ color: '#22c55e' }} labelStyle={{ color: '#94a3b8' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={function(v: any) { return [v + '%', 'Win Rate']; }} /><Bar dataKey='winRate' radius={2} minPointSize={4}>{typeData.map(function(_: any, i: number) { return <Cell key={i} fill='#22c55e' />; })}</Bar></BarChart></ResponsiveContainer></div>)}
              </div>
              {recentBets.length > 0 && (
                <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>{selectedArchive ? 'BETS SETTLED DURING ' + selectedArchive.title.toUpperCase() : viewMode === 'alltime' ? 'ALL TIME SETTLED BETS' : 'RECENT SETTLED BETS'}</div>
                  <div style={{ overflowX: 'auto' as const }}><table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '11px' }}><thead><tr>{['Settled','Game','Pick','Odds','Stake','Result','P\&L',''].map(function(h) { return <th key={h} style={{ color: '#475569', textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #1e3a5f', letterSpacing: '1px' }}>{h}</th>; })}</tr></thead><tbody>{recentBets.map(function(bet: any) { return <BetRow key={bet.id} bet={bet} selectedArchive={selectedArchive} onSaved={async function() { const res = await fetch('/api/analytics', { headers: { 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token } }); if (res.ok) { const d = await res.json(); setData(d); } }} onDeleted={async function() { const res = await fetch('/api/analytics', { headers: { 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token } }); if (res.ok) { const d = await res.json(); setData(d); } }} />; })}</tbody></table></div>
                </div>
              )}
              {recentBets.length === 0 && <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '40px', textAlign: 'center' as const, color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div><div style={{ fontSize: '14px', marginBottom: '4px' }}>No settled bets yet</div><div style={{ fontSize: '11px' }}>Log bets and settle them to see your analytics</div></div>}
            </div>
            {archives.length > 0 && (
              <div style={{ width: '200px', flexShrink: 0 }}>
                <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '10px' }}>ARCHIVE SPLITS</div>
                {archives.map(function(archive: any) {
                  const stats = archiveStats(archive.bets || []);
                  const isSelected = selectedArchive?.id === archive.id;
                  return (<div key={archive.id} onClick={() => setSelectedArchive(isSelected ? null : archive)} style={{ background: isSelected ? '#162040' : '#0f1629', border: '1px solid ' + (isSelected ? '#22c55e' : '#1e3a5f'), borderRadius: '6px', padding: '12px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.15s' }}><div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '2px' }}>{archive.title}</div><div style={{ fontSize: '10px', color: '#475569', marginBottom: '6px' }}>{new Date(archive.createdAt).toLocaleDateString()} · {(archive.bets || []).length} bets</div><div style={{ fontSize: '11px', color: stats.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{stats.pnl >= 0 ? '+$' : '-$'}{Math.abs(stats.pnl).toFixed(2)}</div><div style={{ fontSize: '10px', color: '#475569' }}>{stats.wr}% win · {stats.won}W-{stats.lost}L</div>{isSelected && <div style={{ fontSize: '9px', color: '#22c55e', marginTop: '4px', letterSpacing: '1px' }}>● VIEWING</div>}</div>);
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
