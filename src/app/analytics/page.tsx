'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '16px 20px', flex: 1, minWidth: '140px' }}>
      <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ color: color || '#e2e8f0', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(function() {
    supabase.auth.getSession().then(async function({ data: { session } }) {
      if (!session) { setError('Please log in to view analytics.'); setLoading(false); return; }
      const res = await fetch('/api/analytics', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setData(json);
      setLoading(false);
    });
  }, []);

  const s = data?.summary;
  const pnlColor = s?.pnl >= 0 ? '#22c55e' : '#ef4444';
  const roiColor = s?.roi >= 0 ? '#22c55e' : '#ef4444';
  const streakLabel = s?.streak > 0 ? (s.streakType === 'won' ? '🔥 ' + s.streak + 'W' : '❄️ ' + s.streak + 'L') : '-';

  return (
    <main style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e2e8f0', fontFamily: 'monospace', padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>ANALYTICS</div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>Your betting performance</div>
          </div>
          <a href='/' style={{ color: '#475569', fontSize: '11px', textDecoration: 'none', border: '1px solid #1e3a5f', padding: '6px 12px', borderRadius: '4px', letterSpacing: '1px' }}>← BACK</a>
        </div>

        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '64px' }}>Loading analytics...</div>}
        {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: '64px' }}>{error}</div>}

        {data && s && (
          <div>
            {/* Top stats row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
              <StatCard label='Win Rate' value={s.winRate + '%'} sub={s.wonBets + 'W - ' + s.lostBets + 'L'} color={s.winRate >= 50 ? '#22c55e' : '#f87171'} />
              <StatCard label='ROI' value={(s.roi >= 0 ? '+' : '') + s.roi + '%'} sub={'on $' + s.totalStaked + ' staked'} color={roiColor} />
              <StatCard label='Total P&L' value={(s.pnl >= 0 ? '+$' : '-$') + Math.abs(s.pnl).toFixed(2)} sub={s.settledBets + ' settled bets'} color={pnlColor} />
              <StatCard label='Streak' value={streakLabel} sub={s.pendingBets + ' pending'} />
            </div>

            {/* P&L Chart */}
            {data.pnlOverTime && data.pnlOverTime.length > 1 && (
              <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>P&L OVER TIME</div>
                <ResponsiveContainer width='100%' height={200}>
                  <LineChart data={data.pnlOverTime}>
                    <XAxis dataKey='date' tick={{ fill: '#475569', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}
                      formatter={function(value: any) { return ['$' + value, 'P&L']; }}
                    />
                    <Line type='monotone' dataKey='pnl' stroke={s.pnl >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {data.pnlOverTime && data.pnlOverTime.length <= 1 && (
              <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', marginBottom: '20px', textAlign: 'center' as const, color: '#475569', fontSize: '12px' }}>
                Settle more bets to see your P&L chart
              </div>
            )}

            {/* League + Bet Type breakdown */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>

              {data.byLeague && data.byLeague.length > 0 && (
                <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', flex: 1, minWidth: '280px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>WIN RATE BY LEAGUE</div>
                  <ResponsiveContainer width='100%' height={160}>
                    <BarChart data={data.byLeague} layout='vertical'>
                      <XAxis type='number' domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                      <YAxis type='category' dataKey='league' tick={{ fill: '#94a3b8', fontSize: 10 }} width={50} />
                      <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', fontFamily: 'monospace', fontSize: '11px' }} formatter={function(v: any) { return [v + '%', 'Win Rate']; }} />
                      <Bar dataKey='winRate' radius={2}>
                        {data.byLeague.map(function(entry: any, i: number) {
                          return <Cell key={i} fill={entry.winRate >= 50 ? '#22c55e' : '#ef4444'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.byBetType && data.byBetType.length > 0 && (
                <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px', flex: 1, minWidth: '280px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>WIN RATE BY BET TYPE</div>
                  <ResponsiveContainer width='100%' height={160}>
                    <BarChart data={data.byBetType} layout='vertical'>
                      <XAxis type='number' domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                      <YAxis type='category' dataKey='type' tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                      <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', fontFamily: 'monospace', fontSize: '11px' }} formatter={function(v: any) { return [v + '%', 'Win Rate']; }} />
                      <Bar dataKey='winRate' radius={2}>
                        {data.byBetType.map(function(entry: any, i: number) {
                          return <Cell key={i} fill={entry.winRate >= 50 ? '#22c55e' : '#ef4444'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent bets table */}
            {data.recentBets && data.recentBets.length > 0 && (
              <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '20px' }}>
                <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px' }}>RECENT SETTLED BETS</div>
                <div style={{ overflowX: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '11px' }}>
                    <thead>
                      <tr>
                        {['Date', 'Game', 'Pick', 'Odds', 'Stake', 'Result', 'P&L'].map(function(h) {
                          return <th key={h} style={{ color: '#475569', textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #1e3a5f', letterSpacing: '1px' }}>{h}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentBets.map(function(bet: any) {
                        const rowColor = bet.status === 'won' ? '#0d2a1a' : bet.status === 'lost' ? '#2a0d0d' : 'transparent';
                        const pnlColor = bet.pnl > 0 ? '#22c55e' : bet.pnl < 0 ? '#ef4444' : '#475569';
                        return (
                          <tr key={bet.id} style={{ background: rowColor, borderBottom: '1px solid #1e3a5f' }}>
                            <td style={{ padding: '8px', color: '#475569' }}>{bet.date}</td>
                            <td style={{ padding: '8px', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{bet.game}</td>
                            <td style={{ padding: '8px', color: '#e2e8f0', fontWeight: 'bold' }}>{bet.pick}</td>
                            <td style={{ padding: '8px', color: '#94a3b8' }}>{bet.odds > 0 ? '+' + bet.odds : bet.odds}</td>
                            <td style={{ padding: '8px', color: '#94a3b8' }}>\</td>
                            <td style={{ padding: '8px', color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#475569', fontWeight: 'bold', textTransform: 'uppercase' as const }}>{bet.status}</td>
                            <td style={{ padding: '8px', color: pnlColor, fontWeight: 'bold' }}>{bet.pnl >= 0 ? '+\$' : '-\$'}{Math.abs(bet.pnl).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.recentBets && data.recentBets.length === 0 && (
              <div style={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '40px', textAlign: 'center' as const, color: '#475569' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                <div style={{ fontSize: '14px', marginBottom: '4px' }}>No settled bets yet</div>
                <div style={{ fontSize: '11px' }}>Log bets and settle them to see your analytics</div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}