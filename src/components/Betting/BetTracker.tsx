'use client';
import React, { useState, useEffect } from 'react';
import { getBets, updateBet, deleteBet, getPortfolioStats, calcPayout, Bet } from '@/lib/storage';
import { getSupabaseBets, updateSupabaseBet, deleteSupabaseBet } from '@/lib/supabase-storage';
import { supabase } from '@/lib/supabase/client';
import AddBetForm from './AddBetForm';

interface Archive { id: string; title: string; createdAt: string; bets: Bet[]; }
interface BetTrackerProps { onClose: () => void; defaultSportsbook?: string; allGames?: any[]; allOdds?: Record<string, any>; }

function fmtOdds(o: number): string { return o > 0 ? '+' + o : '' + o; }
function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+$' : '-$';
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(2) + 'M';
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K';
  return sign + abs.toFixed(2);
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return React.createElement('div', { style: { background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '10px 12px', flex: 1, minWidth: '80px' } },
    React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' } }, label),
    React.createElement('div', { style: { color: color || '#e2e8f0', fontSize: '16px', fontWeight: 'bold' } }, value)
  );
}

const ARCHIVE_KEY = 'sportspulse_archives_v2';

function loadArchives(): Archive[] {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}

function saveArchives(archives: Archive[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archives));
}

export default function BetTracker({ onClose, defaultSportsbook = 'DraftKings', allGames = [], allOdds = {} }: BetTrackerProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'history' | 'add' | 'ev' | 'archive'>('open');
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [archiveTitle, setArchiveTitle] = useState('');
  const [viewMode, setViewMode] = useState<'current' | 'alltime'>('current');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function reload() {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
    if (session) {
      const b = await getSupabaseBets();
      setBets(b);
    } else {
      // Clear any locally stored bets for logged-out users
      localStorage.removeItem('sportspulse_bets_v1');
      setBets([]);
    }
    setArchives(loadArchives());
  }

  useEffect(function() { reload(); }, []);

  const currentBets = bets;
  const archiveBets = archives.flatMap(function(a) { return a.bets; });
  const allHistoricalBets = [...currentBets, ...archiveBets];

  const currentStats = getPortfolioStats(currentBets);
  const allTimeStats = getPortfolioStats(allHistoricalBets);
  const displayStats = viewMode === 'current' ? currentStats : allTimeStats;

  const openBets = currentBets.filter(function(b) { return b.status === 'open'; });
  const settledBets = currentBets.filter(function(b) { return b.status !== 'open'; });

  function settle(bet: Bet, result: 'won' | 'lost' | 'push') {
    const payout = result === 'won' ? calcPayout(bet.stake, bet.odds) : 0;
    supabase.auth.getSession().then(function({ data: { session } }) {
      if (session) {
        updateSupabaseBet(bet.id, { status: result, payout }).then(function() { setSettlingId(null); reload(); });
      } else {
        updateBet(bet.id, { status: result, payout });
        setSettlingId(null);
        reload();
      }
    });
  }

  function handleDelete(bet: Bet) {
    supabase.auth.getSession().then(function({ data: { session } }) {
      if (session) { deleteSupabaseBet(bet.id).then(reload); }
      else { deleteBet(bet.id); reload(); }
    });
  }

  async function handleArchive() {
    if (!archiveTitle.trim()) return;
    if (currentBets.length === 0) { alert('No bets to archive.'); return; }
    const archive: Archive = { id: Date.now().toString(36), title: archiveTitle.trim(), createdAt: new Date().toISOString(), bets: currentBets };
    const newArchives = [archive, ...loadArchives()];
    saveArchives(newArchives);
    setArchives(newArchives);
    setArchiveTitle('');
    // Delete all current bets from Supabase if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await Promise.all(currentBets.map(function(b) { return deleteSupabaseBet(b.id); }));
    } else {
      localStorage.setItem('sportspulse_bets_v1', JSON.stringify([]));
    }
    setBets([]);
  }

  const tabs = ['open', 'history', 'add', 'ev', 'archive'];
  const tabLabels: Record<string, string> = { open: 'Open', history: 'History', add: '+ Add', ev: 'EV', archive: 'Archive' };
  const pnlColor = displayStats.pnl >= 0 ? '#22c55e' : '#ef4444';
  const roiColor = displayStats.roi >= 0 ? '#22c55e' : '#ef4444';
  const selectedArchive = archives.find(function(a) { return a.id === selectedArchiveId; });

  return React.createElement('div', { style: { position: 'fixed', right: 0, top: 0, height: '100%', width: '420px', background: '#0a0e1a', borderLeft: '1px solid #1e3a5f', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#e2e8f0' } },
    React.createElement('div', { style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px' } }, 'BET TRACKER'),
        React.createElement('div', { style: { fontSize: '10px', color: '#475569', marginTop: '2px' } }, currentBets.length + ' bets tracked')
      ),
      React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        React.createElement('button', {
          onClick: function() { setViewMode(function(v) { return v === 'current' ? 'alltime' : 'current'; }); },
          style: { padding: '3px 8px', background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px' }
        }, viewMode === 'current' ? 'ALL TIME' : 'CURRENT'),
        React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: '#475569', fontSize: '18px', cursor: 'pointer' } }, 'X')
      )
    ),
    React.createElement('div', { style: { display: 'flex', gap: '8px', padding: '10px 16px', borderBottom: '1px solid #1e3a5f' } },
      React.createElement(StatCard, { label: 'P&L', value: isLoggedIn ? fmtMoney(displayStats.pnl) : '-' , color: isLoggedIn ? pnlColor : '#475569' }),
      React.createElement(StatCard, { label: 'ROI', value: isLoggedIn ? displayStats.roi.toFixed(1) + '%' : '-', color: isLoggedIn ? roiColor : '#475569' }),
      React.createElement(StatCard, { label: 'Win %', value: isLoggedIn ? displayStats.winRate.toFixed(0) + '%' : '-' }),
      React.createElement(StatCard, { label: 'Open', value: isLoggedIn ? String(displayStats.openBets) : '-' })
    ),
    React.createElement('div', { style: { display: 'flex', borderBottom: '1px solid #1e3a5f', overflowX: 'auto' as const } },
      tabs.map(function(tab) {
        return React.createElement('button', { key: tab, onClick: function() { setActiveTab(tab as any); setSelectedArchiveId(null); }, style: { flex: 1, padding: '8px 4px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #22c55e' : '2px solid transparent', color: activeTab === tab ? '#22c55e' : '#475569', cursor: 'pointer', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const } }, tabLabels[tab]);
      })
    ),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto' as const, paddingBottom: '36px' } },

      activeTab === 'open' && !isLoggedIn && React.createElement('div', { style: { padding: '48px 24px', textAlign: 'center' as const } },
        React.createElement('div', { style: { fontSize: '32px', marginBottom: '16px' } }, '🔒'),
        React.createElement('div', { style: { color: '#e2e8f0', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' } }, 'Log in to track bets'),
        React.createElement('div', { style: { color: '#475569', fontSize: '12px', marginBottom: '24px' } }, 'Your bets are saved to your account and persist across devices.'),
        React.createElement('a', { href: '/auth', style: { display: 'inline-block', padding: '10px 24px', background: '#22c55e', color: '#000', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', textDecoration: 'none' } }, 'LOG IN / SIGN UP')
      ),
      activeTab === 'open' && isLoggedIn && React.createElement('div', null,
        openBets.length === 0
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center' as const, color: '#475569', fontSize: '12px' } }, 'No open bets. Click + Add to log one.')
          : openBets.map(function(bet) {
              var toWin = calcPayout(bet.stake, bet.odds);
              var isSettling = settlingId === bet.id;
              return React.createElement('div', { key: bet.id, style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f', background: isSettling ? '#162040' : 'transparent' } },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
                  React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' } }, bet.league),
                  React.createElement('span', { style: { color: '#f59e0b', fontSize: '10px' } }, 'OPEN')
                ),
                React.createElement('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' } }, bet.selection),
                React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: bet.notes ? '4px' : '6px' } }, bet.game),
                bet.notes && React.createElement('div', { style: { color: '#475569', fontSize: '10px', fontStyle: 'italic', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #1e3a5f' } }, bet.notes),
                React.createElement('div', { style: { display: 'flex', gap: '12px', fontSize: '11px', marginBottom: '8px', flexWrap: 'wrap' as const } },
                  React.createElement('span', { style: { color: '#475569' } }, bet.betType),
                  React.createElement('span', { style: { color: '#e2e8f0' } }, fmtOdds(bet.odds)),
                  React.createElement('span', { style: { color: '#475569' } }, '$' + bet.stake.toFixed(2) + ' to win'),
                  React.createElement('span', { style: { color: '#22c55e' } }, '$' + toWin.toFixed(2)),
                  React.createElement('span', { style: { color: '#475569' } }, bet.sportsbook)
                ),
                isSettling
                  ? React.createElement('div', { style: { display: 'flex', gap: '6px' } },
                      React.createElement('button', { onClick: function() { settle(bet, 'won'); }, style: { flex: 1, padding: '6px', background: '#22c55e', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' } }, 'WON'),
                      React.createElement('button', { onClick: function() { settle(bet, 'lost'); }, style: { flex: 1, padding: '6px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' } }, 'LOST'),
                      React.createElement('button', { onClick: function() { settle(bet, 'push'); }, style: { flex: 1, padding: '6px', background: '#475569', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' } }, 'PUSH'),
                      React.createElement('button', { onClick: function() { setSettlingId(null); }, style: { padding: '6px 8px', background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' } }, 'X')
                    )
                  : React.createElement('div', { style: { display: 'flex', gap: '6px' } },
                      React.createElement('button', { onClick: function() { setSettlingId(bet.id); }, style: { flex: 1, padding: '5px', background: 'none', border: '1px solid #1e3a5f', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' } }, 'Settle'),
                      React.createElement('button', { onClick: function() { handleDelete(bet); }, style: { padding: '5px 8px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' } }, 'Del')
                    )
              );
            })
      ),

      activeTab === 'history' && React.createElement('div', null,
        settledBets.length === 0
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center' as const, color: '#475569', fontSize: '12px' } }, 'No settled bets yet.')
          : settledBets.map(function(bet) {
              var statusColor = bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#475569';
              var pnl = bet.status === 'won' ? (bet.payout || 0) : bet.status === 'lost' ? -bet.stake : 0;
              return React.createElement('div', { key: bet.id, style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f' } },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
                  React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold' } }, bet.league),
                  React.createElement('span', { style: { color: statusColor, fontSize: '10px', fontWeight: 'bold' } }, bet.status.toUpperCase())
                ),
                React.createElement('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' } }, bet.selection),
                React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: bet.notes ? '4px' : '4px' } }, bet.game),
                bet.notes && React.createElement('div', { style: { color: '#475569', fontSize: '10px', fontStyle: 'italic', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #1e3a5f' } }, bet.notes),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px' } },
                  React.createElement('span', { style: { color: '#475569' } }, fmtOdds(bet.odds) + ' · $' + bet.stake.toFixed(2)),
                  React.createElement('span', { style: { color: pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' } }, fmtMoney(pnl))
                )
              );
            })
      ),

      activeTab === 'add' && !isLoggedIn && React.createElement('div', { style: { padding: '48px 24px', textAlign: 'center' as const } },
        React.createElement('div', { style: { fontSize: '32px', marginBottom: '16px' } }, '🔒'),
        React.createElement('div', { style: { color: '#e2e8f0', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' } }, 'Log in to track bets'),
        React.createElement('div', { style: { color: '#475569', fontSize: '12px', marginBottom: '24px' } }, 'Your bets are saved to your account and persist across devices.'),
        React.createElement('a', { href: '/auth', style: { display: 'inline-block', padding: '10px 24px', background: '#22c55e', color: '#000', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', textDecoration: 'none' } }, 'LOG IN / SIGN UP')
      ),
      activeTab === 'add' && isLoggedIn && React.createElement(AddBetForm, { onBetAdded: function() { setActiveTab('open'); reload(); }, defaultSportsbook, allGames, allOdds }),

      activeTab === 'ev' && React.createElement('div', { style: { padding: '16px' } },
        React.createElement('div', { style: { color: '#475569', fontSize: '11px', textAlign: 'center' as const, paddingTop: '16px' } }, 'EV calculator coming soon.')
      ),

      activeTab === 'archive' && !selectedArchiveId && React.createElement('div', { style: { padding: '16px' } },
        React.createElement('div', { style: { marginBottom: '16px' } },
          React.createElement('div', { style: { color: '#94a3b8', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' } }, 'SAVE CURRENT BETS AS A SPLIT'),
          React.createElement('input', {
            value: archiveTitle,
            onChange: function(e: any) { setArchiveTitle(e.target.value); },
            placeholder: 'e.g. March 2026',
            style: { width: '100%', background: '#0f1629', border: '1px solid #1e3a5f', color: '#e2e8f0', padding: '6px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' as const, marginBottom: '8px' }
          }),
          React.createElement('button', {
            onClick: handleArchive,
            style: { width: '100%', padding: '8px', background: '#1e3a5f', border: 'none', color: '#e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1px' }
          }, 'ARCHIVE & RESET')
        ),
        archives.length === 0
          ? React.createElement('div', { style: { color: '#475569', fontSize: '11px', textAlign: 'center' as const } }, 'No splits yet.')
          : archives.map(function(archive) {
              const archiveStats = getPortfolioStats(archive.bets);
              return React.createElement('div', { key: archive.id,
                style: { padding: '10px', border: '1px solid #1e3a5f', borderRadius: '4px', marginBottom: '8px', cursor: 'pointer', background: '#0f1629' },
                onClick: function() { setSelectedArchiveId(archive.id); }
              },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' } },
                  React.createElement('span', { style: { color: '#e2e8f0', fontWeight: 'bold' } }, archive.title),
                  React.createElement('span', { style: { color: '#475569' } }, archive.bets.length + ' bets')
                ),
                React.createElement('div', { style: { display: 'flex', gap: '12px', fontSize: '10px' } },
                  React.createElement('span', { style: { color: archiveStats.pnl >= 0 ? '#22c55e' : '#ef4444' } }, fmtMoney(archiveStats.pnl)),
                  React.createElement('span', { style: { color: '#475569' } }, archiveStats.winRate.toFixed(0) + '% win rate'),
                  React.createElement('span', { style: { color: '#475569' } }, new Date(archive.createdAt).toLocaleDateString())
                )
              );
            })
      ),

      activeTab === 'archive' && selectedArchiveId && selectedArchive && React.createElement('div', null,
        React.createElement('div', { style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' } }, selectedArchive.title),
            React.createElement('div', { style: { fontSize: '10px', color: '#475569', marginTop: '2px' } }, selectedArchive.bets.length + ' bets · ' + new Date(selectedArchive.createdAt).toLocaleDateString())
          ),
          React.createElement('button', { onClick: function() { setSelectedArchiveId(null); }, style: { background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' } }, '← BACK')
        ),
        (function() {
          const s = getPortfolioStats(selectedArchive.bets);
          return React.createElement('div', { style: { display: 'flex', gap: '8px', padding: '10px 16px', borderBottom: '1px solid #1e3a5f' } },
            React.createElement(StatCard, { label: 'P&L', value: fmtMoney(s.pnl), color: s.pnl >= 0 ? '#22c55e' : '#ef4444' }),
            React.createElement(StatCard, { label: 'ROI', value: s.roi.toFixed(1) + '%', color: s.roi >= 0 ? '#22c55e' : '#ef4444' }),
            React.createElement(StatCard, { label: 'Win %', value: s.winRate.toFixed(0) + '%' }),
            React.createElement(StatCard, { label: 'Bets', value: String(s.totalBets) })
          );
        })(),
        selectedArchive.bets.map(function(bet) {
          var statusColor = bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#f59e0b';
          var pnl = bet.status === 'won' ? (bet.payout || 0) : bet.status === 'lost' ? -bet.stake : 0;
          return React.createElement('div', { key: bet.id, style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
              React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold' } }, bet.league),
              React.createElement('span', { style: { color: statusColor, fontSize: '10px', fontWeight: 'bold' } }, bet.status.toUpperCase())
            ),
            React.createElement('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' } }, bet.selection),
            React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: bet.notes ? '4px' : '4px' } }, bet.game),
            bet.notes && React.createElement('div', { style: { color: '#475569', fontSize: '10px', fontStyle: 'italic', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #1e3a5f' } }, bet.notes),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px' } },
              React.createElement('span', { style: { color: '#475569' } }, fmtOdds(bet.odds) + ' · $' + bet.stake.toFixed(2)),
              React.createElement('span', { style: { color: pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' } }, fmtMoney(pnl))
            )
          );
        })
      )
    )
  );
}