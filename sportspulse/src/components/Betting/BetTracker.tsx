'use client';

import React, { useState, useEffect } from 'react';
import { getBets, updateBet, deleteBet, getPortfolioStats, getArchives, archiveAndReset, calcPayout, Bet, Archive } from '@/lib/storage';
import AddBetForm from './AddBetForm';

interface BetTrackerProps {
  onClose: () => void;
  defaultSportsbook?: string;
  allGames?: any[];
  allOdds?: Record<string, any>;
}

function fmtOdds(o: number): string { return o > 0 ? '+' + o : '' + o; }
function fmtMoney(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return (n >= 0 ? '+$' : '-$') + abs;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return React.createElement('div', {
    style: { background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '10px 12px', flex: 1, minWidth: '80px' }
  },
    React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' } }, label),
    React.createElement('div', { style: { color: color || '#e2e8f0', fontSize: '16px', fontWeight: 'bold' } }, value)
  );
}

export default function BetTracker({ onClose, defaultSportsbook = 'DraftKings', allGames = [], allOdds = {} }: BetTrackerProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'history' | 'add' | 'ev' | 'archive'>('open');
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [archiveTitle, setArchiveTitle] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'alltime'>('current');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  function reload() { setBets(getBets()); setArchives(getArchives()); }
  useEffect(function() { reload(); }, []);

  const stats = getPortfolioStats(bets);

  // All-time stats across all archives + current
  const allBets = [...bets, ...archives.flatMap(function(a) { return a.bets; })];
  const allTimeStats = getPortfolioStats(allBets);
  const displayStats = viewMode === 'current' ? stats : allTimeStats;

  const openBets = bets.filter(function(b) { return b.status === 'open'; });
  const settledBets = bets.filter(function(b) { return b.status !== 'open'; });

  function settle(bet: Bet, result: 'won' | 'lost' | 'push') {
    const payout = result === 'won' ? calcPayout(bet.stake, bet.odds) : 0;
    updateBet(bet.id, { status: result, payout: result === 'won' ? payout : 0 });
    setSettlingId(null);
    reload();
  }

  function handleArchive() {
    if (!archiveTitle.trim()) return;
    archiveAndReset(archiveTitle.trim());
    setArchiveTitle('');
    setShowArchiveConfirm(false);
    reload();
    setActiveTab('open');
  }

  const selectedArchive = archives.find(function(a) { return a.id === selectedArchiveId; });

  var panelStyle = {
    position: 'fixed' as const, right: 0, top: 0, height: '100%', width: '400px',
    background: '#0f1629', borderLeft: '1px solid #1e3a5f',
    zIndex: 1001, display: 'flex', flexDirection: 'column' as const,
    fontFamily: 'monospace', color: '#e2e8f0',
  };

  var tabs = ['open', 'history', 'add', 'ev', 'archive'];
  var tabLabels: Record<string, string> = { open: 'Open', history: 'History', add: '+ Add', ev: 'EV', archive: 'Archive' };

  var pnlColor = displayStats.pnl > 0 ? '#22c55e' : displayStats.pnl < 0 ? '#ef4444' : '#e2e8f0';
  var roiColor = displayStats.roi > 0 ? '#22c55e' : displayStats.roi < 0 ? '#ef4444' : '#e2e8f0';

  return React.createElement('div', { style: panelStyle },

    React.createElement('div', { style: { padding: '16px', borderBottom: '1px solid #1e3a5f' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('div', null,
          React.createElement('div', { style: { color: '#22c55e', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' } }, 'BET TRACKER'),
          React.createElement('div', { style: { color: '#475569', fontSize: '11px', marginTop: '2px' } }, stats.totalBets + ' bets tracked')
        ),
        React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
          React.createElement('button', {
            onClick: function() { setViewMode(function(v) { return v === 'current' ? 'alltime' : 'current'; }); },
            style: { padding: '3px 8px', background: viewMode === 'alltime' ? '#475569' : 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontFamily: 'monospace' }
          }, viewMode === 'current' ? 'ALL TIME' : 'CURRENT'),
          React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' } }, 'X')
        )
      )
    ),

    React.createElement('div', { style: { display: 'flex', gap: '8px', padding: '12px 16px', flexWrap: 'wrap' as const } },
      React.createElement(StatCard, { label: 'P&L', value: fmtMoney(displayStats.pnl), color: pnlColor }),
      React.createElement(StatCard, { label: 'ROI', value: displayStats.roi.toFixed(1) + '%', color: roiColor }),
      React.createElement(StatCard, { label: 'Win %', value: displayStats.winRate.toFixed(0) + '%' }),
      React.createElement(StatCard, { label: 'Open', value: String(stats.openBets) })
    ),

    React.createElement('div', { style: { display: 'flex', borderBottom: '1px solid #1e3a5f', overflowX: 'auto' as const } },
      tabs.map(function(tab) {
        return React.createElement('button', {
          key: tab,
          onClick: function() { setActiveTab(tab as any); },
          style: {
            flex: 1, padding: '8px 4px', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #22c55e' : '2px solid transparent',
            color: activeTab === tab ? '#22c55e' : '#475569',
            cursor: 'pointer', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const,
          }
        }, tabLabels[tab]);
      })
    ),

    React.createElement('div', { style: { flex: 1, overflowY: 'auto' as const, paddingBottom: '36px' } },

      activeTab === 'open' && React.createElement('div', null,
        openBets.length === 0
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center' as const, color: '#475569', fontSize: '12px' } },
              'No open bets. Click + Add to log one.'
            )
          : openBets.map(function(bet) {
              var toWin = calcPayout(bet.stake, bet.odds);
              var isSettling = settlingId === bet.id;
              return React.createElement('div', {
                key: bet.id,
                style: { padding: '12px 16px', borderBottom: '1px solid #1e3a5f', background: isSettling ? '#162040' : 'transparent' }
              },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
                  React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' } }, bet.league),
                  React.createElement('span', { style: { color: '#f59e0b', fontSize: '10px' } }, 'OPEN')
                ),
                React.createElement('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' } }, bet.selection),
                React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: '6px' } }, bet.game),
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
                      React.createElement('button', { onClick: function() { deleteBet(bet.id); reload(); }, style: { padding: '5px 8px', background: 'none', border: '1px solid #1e3a5f', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace' } }, 'Del')
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
                  React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' } }, bet.league),
                  React.createElement('span', { style: { color: statusColor, fontSize: '10px', fontWeight: 'bold' } }, bet.status.toUpperCase())
                ),
                React.createElement('div', { style: { fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' } }, bet.selection),
                React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: '6px' } }, bet.game),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px' } },
                  React.createElement('span', { style: { color: '#475569' } }, fmtOdds(bet.odds) + ' | $' + bet.stake.toFixed(2) + ' | ' + bet.sportsbook),
                  React.createElement('span', { style: { color: statusColor, fontWeight: 'bold' } }, fmtMoney(pnl))
                )
              );
            })
      ),

      activeTab === 'add' && React.createElement(AddBetForm, {
        onBetAdded: function() { reload(); setActiveTab('open'); },
        defaultSportsbook,
        allGames,
        allOdds,
      }),

      activeTab === 'ev' && React.createElement('div', { style: { padding: '16px' } },
        React.createElement('div', { style: { color: '#22c55e', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px', fontWeight: 'bold' } }, 'EV DASHBOARD'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' } },
          React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px' } },
            React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' } }, 'TOTAL BETS'),
            React.createElement('div', { style: { color: '#e2e8f0', fontSize: '20px', fontWeight: 'bold' } }, displayStats.totalBets),
            React.createElement('div', { style: { color: '#475569', fontSize: '10px', marginTop: '2px' } }, displayStats.openBets + ' open')
          ),
          React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px' } },
            React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' } }, 'WIN RATE'),
            React.createElement('div', { style: { color: displayStats.winRate >= 52.4 ? '#22c55e' : '#ef4444', fontSize: '20px', fontWeight: 'bold' } }, displayStats.winRate.toFixed(1) + '%'),
            React.createElement('div', { style: { color: '#475569', fontSize: '10px', marginTop: '2px' } }, 'breakeven: 52.4%')
          ),
          React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px' } },
            React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' } }, 'TOTAL STAKED'),
            React.createElement('div', { style: { color: '#e2e8f0', fontSize: '20px', fontWeight: 'bold' } }, '$' + displayStats.totalStaked.toFixed(2))
          ),
          React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px' } },
            React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' } }, 'AVG ODDS'),
            React.createElement('div', { style: { color: '#e2e8f0', fontSize: '20px', fontWeight: 'bold' } }, fmtOdds(Math.round(displayStats.avgOdds)))
          )
        ),
        React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px', marginBottom: '12px' } },
          React.createElement('div', { style: { color: '#475569', fontSize: '9px', letterSpacing: '1px', marginBottom: '8px' } }, 'W / L / P BREAKDOWN'),
          React.createElement('div', { style: { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#1e3a5f' } },
            displayStats.totalBets > 0 && React.createElement('div', { style: { width: (displayStats.wonBets / displayStats.totalBets * 100) + '%', background: '#22c55e' } }),
            displayStats.totalBets > 0 && React.createElement('div', { style: { width: (displayStats.lostBets / displayStats.totalBets * 100) + '%', background: '#ef4444' } }),
            displayStats.totalBets > 0 && React.createElement('div', { style: { width: (displayStats.pushBets / displayStats.totalBets * 100) + '%', background: '#475569' } })
          ),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px' } },
            React.createElement('span', { style: { color: '#22c55e' } }, displayStats.wonBets + ' W'),
            React.createElement('span', { style: { color: '#ef4444' } }, displayStats.lostBets + ' L'),
            React.createElement('span', { style: { color: '#475569' } }, displayStats.pushBets + ' P')
          )
        )
      ),

      activeTab === 'archive' && React.createElement('div', { style: { padding: '16px' } },
        React.createElement('div', { style: { color: '#22c55e', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px', fontWeight: 'bold' } }, 'ARCHIVE & RESET'),

        !showArchiveConfirm && React.createElement('div', null,
          React.createElement('div', { style: { color: '#94a3b8', fontSize: '11px', marginBottom: '12px' } },
            'Archive your current bets with a title and start fresh. Your history is preserved.'
          ),
          React.createElement('input', {
            value: archiveTitle,
            onChange: function(e: any) { setArchiveTitle(e.target.value); },
            placeholder: 'e.g. Week of 3/23, March Madness 2025',
            style: { width: '100%', background: '#0a0e1a', border: '1px solid #1e3a5f', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' as const, marginBottom: '8px' }
          }),
          React.createElement('button', {
            onClick: function() { if (archiveTitle.trim()) setShowArchiveConfirm(true); },
            style: { width: '100%', padding: '10px', background: archiveTitle.trim() ? '#f59e0b' : '#1e3a5f', border: 'none', color: archiveTitle.trim() ? '#000' : '#475569', borderRadius: '4px', cursor: archiveTitle.trim() ? 'pointer' : 'default', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }
          }, 'ARCHIVE & RESET')
        ),

        showArchiveConfirm && React.createElement('div', { style: { background: '#0a0e1a', border: '1px solid #f59e0b', borderRadius: '6px', padding: '16px', marginBottom: '16px' } },
          React.createElement('div', { style: { color: '#f59e0b', fontSize: '12px', marginBottom: '12px' } }, 'Archive "' + archiveTitle + '" and reset current bets?'),
          React.createElement('div', { style: { display: 'flex', gap: '8px' } },
            React.createElement('button', { onClick: handleArchive, style: { flex: 1, padding: '8px', background: '#f59e0b', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' } }, 'CONFIRM'),
            React.createElement('button', { onClick: function() { setShowArchiveConfirm(false); }, style: { flex: 1, padding: '8px', background: 'none', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace' } }, 'CANCEL')
          )
        ),

        archives.length > 0 && React.createElement('div', null,
          React.createElement('div', { style: { color: '#475569', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px', marginTop: '16px' } }, 'PAST ARCHIVES'),
          archives.map(function(archive) {
            const aStats = getPortfolioStats(archive.bets);
            const isSelected = selectedArchiveId === archive.id;
            return React.createElement('div', { key: archive.id },
              React.createElement('div', {
                onClick: function() { setSelectedArchiveId(isSelected ? null : archive.id); },
                style: { padding: '10px', background: isSelected ? '#162040' : '#0a0e1a', border: '1px solid ' + (isSelected ? '#22c55e' : '#1e3a5f'), borderRadius: '6px', cursor: 'pointer', marginBottom: '6px' }
              },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  React.createElement('div', { style: { color: '#e2e8f0', fontSize: '12px', fontWeight: 'bold' } }, archive.title),
                  React.createElement('div', { style: { color: aStats.pnl >= 0 ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 'bold' } }, fmtMoney(aStats.pnl))
                ),
                React.createElement('div', { style: { color: '#475569', fontSize: '10px', marginTop: '4px' } },
                  aStats.totalBets + ' bets | ' + aStats.wonBets + '-' + aStats.lostBets + ' | ROI: ' + aStats.roi.toFixed(1) + '%'
                )
              ),
              isSelected && React.createElement('div', { style: { padding: '8px 0', marginBottom: '8px' } },
                archive.bets.map(function(bet) {
                  var statusColor = bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#475569';
                  var pnl = bet.status === 'won' ? (bet.payout || 0) : bet.status === 'lost' ? -bet.stake : 0;
                  return React.createElement('div', { key: bet.id, style: { padding: '8px 12px', borderBottom: '1px solid #1e3a5f', fontSize: '11px' } },
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                      React.createElement('span', { style: { color: '#e2e8f0' } }, bet.selection),
                      React.createElement('span', { style: { color: statusColor, fontWeight: 'bold' } }, fmtMoney(pnl))
                    ),
                    React.createElement('div', { style: { color: '#475569', fontSize: '10px' } }, bet.game + ' | ' + fmtOdds(bet.odds))
                  );
                })
              )
            );
          })
        ),

        archives.length === 0 && React.createElement('div', { style: { color: '#475569', fontSize: '11px', marginTop: '16px' } }, 'No archives yet.')
      )
    )
  );
}
