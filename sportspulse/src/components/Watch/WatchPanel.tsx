'use client';

import React, { useState, useEffect } from 'react';
import { getBets, Bet } from '@/lib/storage';
import { leagueColor } from '@/lib/leagues';

interface WatchPanelProps {
  games: any[];
  onClose: () => void;
  allBroadcasts?: Record<string, any[]>;
}

interface ScoredGame {
  game: any;
  score: number;
  reasons: string[];
  betRelevance: string[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

function getFallbackBroadcast(league: string): { network: string; url: string }[] {
  const s = league.toUpperCase();
  if (s.includes('NBA')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'NBA TV', url: 'https://www.nba.com/watch' }];
  if (s.includes('NFL')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'NFL Network', url: 'https://www.nfl.com/network/watch' }];
  if (s.includes('MLB') || s.includes('BASEBALL')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'MLB Network', url: 'https://www.mlb.com/network' }];
  if (s.includes('NHL') || s.includes('HOCKEY')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'NHL Network', url: 'https://www.nhl.com/tv' }];
  if (s.includes('NCAAF')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'ABC', url: 'https://abc.com/watch-live' }];
  if (s.includes('NCAAB')) return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'CBS', url: 'https://www.cbs.com/live-tv' }];
  if (s.includes('MMA') || s.includes('MARTIAL')) return [{ network: 'ESPN+', url: 'https://www.espn.com/watch' }, { network: 'UFC Fight Pass', url: 'https://ufcfightpass.com' }];
  return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }];
}

function inlineNormLeague(raw: string): string {
  const s = raw.toUpperCase();
  if (s.includes('NCAAF') || s === 'AMERICANFOOTBALL_NCAAF') return 'NCAAF';
  if (s.includes('NCAAB') || s === 'BASKETBALL_NCAAB') return 'NCAAB';
  if (s.includes('MMA') || s.includes('MARTIAL')) return 'MMA';
  if (s.includes('F1') || s.includes('FORMULA')) return 'F1';
  if (s.includes('BASKET')) return 'NBA';
  if (s.includes('BASEBALL')) return 'MLB';
  if (s.includes('HOCKEY')) return 'NHL';
  if (s.includes('FOOTBALL')) return 'NFL';
  return raw;
}

const SPORT_KEY_MAP: Record<string, string> = {
  NBA: 'basketball_nba', NFL: 'americanfootball_nfl',
  MLB: 'baseball_mlb', NHL: 'icehockey_nhl',
  NCAAF: 'americanfootball_ncaaf', NCAAB: 'basketball_ncaab',
  MMA: 'mma_mixed_martial_arts',
};

function scoreGame(game: any, bets: Bet[]): ScoredGame {
  let score = 0;
  const reasons: string[] = [];
  const betRelevance: string[] = [];
  const home = Number(game.homeScore);
  const away = Number(game.awayScore);
  const scoreDiff = Math.abs(home - away);
  const totalPoints = home + away;
  const isLive = game.status !== 'final' && game.status !== 'scheduled' && new Date() >= new Date(game.gameTime);

  if (isLive) {
    score += 60; // significant boost for live games
    reasons.push('Game is live now');
  } else {
    score += 5;
    reasons.push('Upcoming game');
  }
  if (isLive) {
    if (scoreDiff <= 3) { score += 40; reasons.push('Within ' + scoreDiff + ' pts - very close'); }
    else if (scoreDiff <= 7) { score += 25; reasons.push('Within ' + scoreDiff + ' pts'); }
    else if (scoreDiff <= 14) { score += 10; reasons.push(scoreDiff + ' pt margin'); }
  }

  const gameTeams = [game.homeTeam, game.awayTeam].map(function(t) { return t.toLowerCase(); });
  const relevantBets = bets.filter(function(b) {
    if (b.status !== 'open') return false;
    const betGame = b.game.toLowerCase();
    return gameTeams.some(function(t) { return betGame.includes(t.split(' ').pop() || ''); });
  });

  for (const bet of relevantBets) {
    score += 50;
    if (bet.betType === 'moneyline') {
      const winning = bet.selection.toLowerCase().includes(
        (home > away ? game.homeTeam : game.awayTeam).toLowerCase().split(' ').pop() || ''
      );
      betRelevance.push((winning ? 'W ' : 'L ') + bet.selection + ' ML');
      score += winning ? 20 : 30;
    } else if (bet.betType === 'spread') {
      betRelevance.push('Spread: ' + bet.selection);
      score += 25;
    } else if (bet.betType === 'total') {
      const isOver = bet.selection.toLowerCase().includes('over');
      const line = parseFloat(bet.selection.replace(/[^0-9.]/g, ''));
      if (!isNaN(line)) {
        const remaining = line - totalPoints;
        if (Math.abs(remaining) <= 5) { score += 40; }
        betRelevance.push((isOver ? 'Over ' : 'Under ') + line + ': ' + totalPoints + ' scored');
      }
    }
  }

  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (relevantBets.length > 0 && scoreDiff <= 7) urgency = 'critical';
  else if (relevantBets.length > 0) urgency = 'high';
  else if (scoreDiff <= 3 && isLive) urgency = 'medium';

  return { game, score, reasons, betRelevance, urgency };
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#60a5fa', low: '#475569',
};
const URGENCY_LABELS: Record<string, string> = {
  critical: 'MUST WATCH', high: 'HIGH PRIORITY', medium: 'WORTH WATCHING', low: 'OPTIONAL',
};

export default function WatchPanel({ games, onClose, allBroadcasts = {} }: WatchPanelProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [scoredGames, setScoredGames] = useState<ScoredGame[]>([]);
  const [broadcastMap, setBroadcastMap] = useState<Record<string, { network: string; url: string }[]>>({});

  useEffect(function() {
    setBets(getBets().filter(function(b) { return b.status === 'open'; }));
  }, []);

  useEffect(function() {
    const liveAndUpcoming = games.filter(function(g) { return g.status !== 'final'; });
    const scored = liveAndUpcoming
      .map(function(g) { return scoreGame(g, bets); })
      .sort(function(a, b) { return b.score - a.score; });
    setScoredGames(scored);

    scored.forEach(function(sg) {
      const g = sg.game;
      // Use passed broadcasts first, fall back to fetch
      if (allBroadcasts[g.id] && allBroadcasts[g.id].length > 0) {
        setBroadcastMap(function(prev) {
          return Object.assign({}, prev, { [g.id]: allBroadcasts[g.id] });
        });
        return;
      }
      const league = inlineNormLeague(g.league);
      const sport = SPORT_KEY_MAP[league];
      if (!sport) return;
      fetch('/api/broadcast?sport=' + sport + '&homeTeam=' + encodeURIComponent(g.homeTeam || '') + '&awayTeam=' + encodeURIComponent(g.awayTeam || ''))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.broadcasts && data.broadcasts.length > 0) {
            setBroadcastMap(function(prev) {
              return Object.assign({}, prev, { [g.id]: data.broadcasts });
            });
          }
        })
        .catch(function() {});
    });
  }, [games, bets, allBroadcasts]);

  return React.createElement('div', {
    style: { position: 'fixed', right: 0, top: 0, height: '100%', width: '400px', background: '#0f1629', borderLeft: '1px solid #1e3a5f', zIndex: 1001, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#e2e8f0' }
  },
    React.createElement('div', { style: { padding: '16px', borderBottom: '1px solid #1e3a5f' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        React.createElement('div', null,
          React.createElement('div', { style: { color: '#60a5fa', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' } }, 'SMART WATCH'),
          React.createElement('div', { style: { fontSize: '12px', marginTop: '4px', color: '#94a3b8' } },
            bets.length > 0 ? 'Ranked by bet relevance + game importance' : 'Add bets for personalized recommendations'
          )
        ),
        React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' } }, 'X')
      )
    ),

    React.createElement('div', { style: { flex: 1, overflowY: 'auto', paddingBottom: '36px' } },
      scoredGames.length === 0 && React.createElement('div', {
        style: { padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: '12px' }
      }, 'No live or upcoming games right now'),

      scoredGames.map(function(sg, i) {
        const { game, reasons, betRelevance, urgency } = sg;
        const urgencyColor = URGENCY_COLORS[urgency];
        const league = inlineNormLeague(game.league);
        const color = leagueColor(game.league);
        const isLive = game.status !== 'final' && game.status !== 'scheduled' && new Date() >= new Date(game.gameTime);
        const broadcast = broadcastMap[game.id] || getFallbackBroadcast(game.league);

        return React.createElement('div', {
          key: game.id,
          style: { padding: '14px 16px', borderBottom: '1px solid #1e3a5f', borderLeft: '3px solid ' + urgencyColor }
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
            React.createElement('span', { style: { color: urgencyColor, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' } }, '#' + (i + 1) + ' ' + URGENCY_LABELS[urgency]),
            React.createElement('span', { style: { color: color, fontSize: '10px', letterSpacing: '1px' } }, league)
          ),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' } }, game.awayTeam + ' @ ' + game.homeTeam),
          isLive && React.createElement('div', { style: { fontSize: '20px', fontWeight: 'bold', color: '#22c55e', marginBottom: '6px' } }, game.awayScore + ' - ' + game.homeScore),
          !isLive && React.createElement('div', { style: { color: '#f59e0b', fontSize: '11px', marginBottom: '6px' } },
            new Date(game.gameTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          ),
          reasons.length > 0 && React.createElement('div', { style: { marginBottom: '6px' } },
            reasons.map(function(r, j) {
              return React.createElement('div', { key: j, style: { color: '#94a3b8', fontSize: '10px', marginBottom: '2px' } }, '- ' + r);
            })
          ),
          betRelevance.length > 0 && React.createElement('div', { style: { background: '#0a0e1a', borderRadius: '4px', padding: '6px 8px', marginBottom: '8px' } },
            React.createElement('div', { style: { color: '#f59e0b', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' } }, 'YOUR BETS'),
            betRelevance.map(function(r, j) {
              return React.createElement('div', { key: j, style: { color: '#e2e8f0', fontSize: '11px', marginBottom: '2px' } }, r);
            })
          ),
          React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const } },
            broadcast.slice(0, 3).map(function(b) {
              return React.createElement('a', {
                key: b.network, href: b.url, target: '_blank', rel: 'noopener noreferrer',
                style: { padding: '4px 10px', background: 'none', border: '1px solid #1e3a5f', color: '#60a5fa', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '1px', cursor: 'pointer' }
              }, '▶ ' + b.network);
            })
          )
        );
      })
    )
  );
}
