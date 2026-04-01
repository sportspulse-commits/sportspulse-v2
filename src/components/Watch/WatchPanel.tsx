'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getBets, Bet } from '@/lib/storage';
import { leagueColor } from '@/lib/leagues';
import { supabase } from '@/lib/supabase/client';

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

const URGENCY_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#60a5fa', low: '#475569' };
const URGENCY_LABELS: Record<string, string> = { critical: 'MUST WATCH', high: 'HIGH PRIORITY', medium: 'WORTH WATCHING', low: 'LOW PRIORITY' };

function scoreGame(game: any, bets: Bet[]): ScoredGame {
  let score = 0;
  const reasons: string[] = [];
  const betRelevance: string[] = [];
  const home = Number(game.homeScore);
  const away = Number(game.awayScore);
  const scoreDiff = Math.abs(home - away);
  const totalPoints = home + away;
  const isLive = game.status !== 'final' && game.status !== 'scheduled' && new Date() >= new Date(game.gameTime);
  if (isLive) { score += 60; reasons.push('Game is live now'); } else { score += 5; reasons.push('Upcoming game'); }
  if (isLive && scoreDiff <= 5) { score += 30; reasons.push('Close game (' + scoreDiff + ' point margin)'); }
  if (isLive && scoreDiff <= 3 && (game.period >= 4 || game.clock)) { score += 20; reasons.push('Nail-biter in final minutes'); }
  const openBets = bets.filter(function(b) { return b.status === 'open'; });
  openBets.forEach(function(bet) {
    const gameStr = (bet.game || '').toLowerCase();
    const homeL = (game.homeTeam || '').toLowerCase();
    const awayL = (game.awayTeam || '').toLowerCase();
    if (gameStr.includes(homeL.split(' ').pop() || '') || gameStr.includes(awayL.split(' ').pop() || '')) {
      score += 50; betRelevance.push('You have a bet on this game');
    }
  });
  if (isLive && totalPoints > 200) { score += 10; reasons.push('High-scoring game'); }
  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (score >= 100) urgency = 'critical';
  else if (score >= 70) urgency = 'high';
  else if (score >= 40) urgency = 'medium';
  return { game, score, reasons, betRelevance, urgency };
}

export default function WatchPanel({ games, onClose, allBroadcasts = {} }: WatchPanelProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [scoredGames, setScoredGames] = useState<ScoredGame[]>([]);
  const [broadcastMap, setBroadcastMap] = useState<Record<string, { network: string; url: string }[]>>({});
  const [activeTab, setActiveTab] = useState<'smart' | 'watchlist'>('smart');
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

  useEffect(function() {
    setBets(getBets().filter(function(b) { return b.status === 'open'; }));
    supabase.auth.getSession().then(function({ data: { session } }) {
      setIsLoggedIn(!!session);
    });
  }, []);

  const loadWatchlist = useCallback(async function() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoadingWatchlist(true);
    try {
      const { data, error } = await supabase.from('watchlist').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (!error && data) {
        setWatchlist(data);
        setWatchedIds(new Set(data.map(function(i: any) { return i.game_id; })));
      }
    } catch {}
    setLoadingWatchlist(false);
  }, []);

  useEffect(function() {
    if (isLoggedIn) loadWatchlist();
  }, [isLoggedIn, loadWatchlist]);

  useEffect(function() {
    const liveAndUpcoming = games.filter(function(g) { return g.status !== 'final'; });
    const scored = liveAndUpcoming.map(function(g) { return scoreGame(g, bets); }).sort(function(a, b) { return b.score - a.score; });
    setScoredGames(scored);
    scored.forEach(function(sg) {
      const g = sg.game;
      if (allBroadcasts[g.id] && allBroadcasts[g.id].length > 0) {
        setBroadcastMap(function(prev) { return Object.assign({}, prev, { [g.id]: allBroadcasts[g.id] }); });
        return;
      }
      const league = inlineNormLeague(g.league);
      const sport = SPORT_KEY_MAP[league];
      if (!sport) return;
      fetch('/api/broadcast?sport=' + sport + '&homeTeam=' + encodeURIComponent(g.homeTeam || '') + '&awayTeam=' + encodeURIComponent(g.awayTeam || ''))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.broadcasts && data.broadcasts.length > 0) {
            setBroadcastMap(function(prev) { return Object.assign({}, prev, { [g.id]: data.broadcasts }); });
          }
        }).catch(function() {});
    });
  }, [games, bets, allBroadcasts]);

  async function toggleWatch(game: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const gameId = game.id;
    const isWatched = watchedIds.has(gameId);
    if (isWatched) {
      await supabase.from('watchlist').delete().eq('user_id', session.user.id).eq('game_id', gameId);
      setWatchedIds(function(prev) { const n = new Set(prev); n.delete(gameId); return n; });
      setWatchlist(function(prev) { return prev.filter(function(i: any) { return i.game_id !== gameId; }); });
    } else {
      const league = inlineNormLeague(game.league);
      const { data, error } = await supabase.from('watchlist').insert([{
        user_id: session.user.id,
        game_id: gameId,
        sport: league,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        game_date: (game.gameTime || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      }]).select().single();
      if (!error && data) {
        setWatchedIds(function(prev) { return new Set([...prev, gameId]); });
        setWatchlist(function(prev) { return [data, ...prev]; });
      }
    }
  }

  function renderGameCard(game: any, index: number, urgency: string, reasons: string[], betRelevance: string[]) {
    const urgencyColor = URGENCY_COLORS[urgency] || '#475569';
    const league = inlineNormLeague(game.league);
    const color = leagueColor(game.league);
    const isLive = game.status !== 'final' && game.status !== 'scheduled' && new Date() >= new Date(game.gameTime);
    const broadcast = broadcastMap[game.id] || getFallbackBroadcast(game.league);
    const isWatched = watchedIds.has(game.id);
    return React.createElement('div', {
      key: game.id,
      style: { padding: '14px 16px', borderBottom: '1px solid #1e3a5f', borderLeft: '3px solid ' + urgencyColor }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } },
        React.createElement('span', { style: { color: urgencyColor, fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' } },
          index !== undefined ? '#' + (index + 1) + ' ' + (URGENCY_LABELS[urgency] || '') : league
        ),
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement('span', { style: { color: color, fontSize: '10px', letterSpacing: '1px' } }, league),
          isLoggedIn && React.createElement('button', {
            onClick: function() { toggleWatch(game); },
            title: isWatched ? 'Remove from watchlist' : 'Add to watchlist',
            style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0', lineHeight: 1, color: isWatched ? '#f59e0b' : '#475569' }
          }, isWatched ? '★' : '☆')
        )
      ),
      React.createElement('div', { style: { fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' } }, game.awayTeam + ' @ ' + game.homeTeam),
      isLive && React.createElement('div', { style: { fontSize: '20px', fontWeight: 'bold', color: '#22c55e', marginBottom: '6px' } }, game.awayScore + ' - ' + game.homeScore),
      !isLive && React.createElement('div', { style: { color: '#f59e0b', fontSize: '11px', marginBottom: '6px' } },
        new Date(game.gameTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ),
      reasons.length > 0 && React.createElement('div', { style: { marginBottom: '6px' } },
        reasons.map(function(r, j) { return React.createElement('div', { key: j, style: { color: '#94a3b8', fontSize: '10px', marginBottom: '2px' } }, '— ' + r); })
      ),
      betRelevance.length > 0 && React.createElement('div', { style: { marginBottom: '6px' } },
        betRelevance.map(function(r, j) { return React.createElement('div', { key: j, style: { color: '#22c55e', fontSize: '10px', marginBottom: '2px' } }, '🎯 ' + r); })
      ),
      broadcast.length > 0 && React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        broadcast.slice(0, 3).map(function(b: any) {
          return React.createElement('a', { key: b.network, href: b.url, target: '_blank', rel: 'noopener noreferrer',
            style: { fontSize: '10px', color: '#60a5fa', border: '1px solid #1e3a5f', padding: '2px 6px', borderRadius: '3px', textDecoration: 'none' }
          }, b.network);
        })
      )
    );
  }


  // Auto-remove finished games and only show today's games
  const todayStr = new Date().toISOString().slice(0, 10);
  React.useEffect(function() {
    if (watchlist.length === 0) return;
    watchlist.forEach(async function(item: any) {
      const liveGame = games.find(function(g) { return g.id === item.game_id; });
      const gameDate = (item.game_date || '').slice(0, 10);
      const isOldGame = gameDate < todayStr;
      const isFinished = liveGame && liveGame.status === 'final';
      if (isOldGame || isFinished) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from('watchlist').delete().eq('user_id', session.user.id).eq('game_id', item.game_id);
        setWatchedIds(function(prev) { const n = new Set(prev); n.delete(item.game_id); return n; });
        setWatchlist(function(prev) { return prev.filter(function(i: any) { return i.game_id !== item.game_id; }); });
      }
    });
  }, [watchlist, games, todayStr]);

  const watchlistGames = watchlist.filter(function(item: any) {
    const gameDate = (item.game_date || '').slice(0, 10);
    return gameDate >= todayStr;
  }).map(function(item: any) {
    const liveGame = games.find(function(g) { return g.id === item.game_id; });
    if (liveGame && liveGame.status === 'final') return null;
    return liveGame || { id: item.game_id, homeTeam: item.home_team, awayTeam: item.away_team, league: item.sport, gameTime: item.game_date, homeScore: 0, awayScore: 0, status: 'scheduled' };
  }).filter(Boolean);

  return React.createElement('div', {
    style: { position: 'fixed', right: 0, top: 0, height: '100%', width: '400px', background: '#0f1629', borderLeft: '1px solid #1e3a5f', zIndex: 1001, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#e2e8f0' }
  },
    React.createElement('div', { style: { padding: '16px', borderBottom: '1px solid #1e3a5f' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' } },
        React.createElement('div', null,
          React.createElement('div', { style: { color: '#60a5fa', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' } }, activeTab === 'smart' ? 'SMART WATCH' : 'MY WATCHLIST'),
          React.createElement('div', { style: { fontSize: '12px', marginTop: '4px', color: '#94a3b8' } },
            activeTab === 'smart' ? (bets.length > 0 ? 'Ranked by bet relevance + game importance' : 'Add bets for personalized recommendations') : (watchlist.length + ' game' + (watchlist.length !== 1 ? 's' : '') + ' saved')
          )
        ),
        React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' } }, 'X')
      ),
      React.createElement('div', { style: { display: 'flex', gap: '4px' } },
        ['smart', 'watchlist'].map(function(tab) {
          return React.createElement('button', {
            key: tab, onClick: function() { setActiveTab(tab as 'smart' | 'watchlist'); },
            style: { flex: 1, padding: '6px', background: activeTab === tab ? '#22c55e' : 'transparent', border: '1px solid ' + (activeTab === tab ? '#22c55e' : '#1e3a5f'), color: activeTab === tab ? '#000' : '#475569', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }
          }, tab === 'smart' ? 'SMART WATCH' : ('★ WATCHLIST' + (watchlist.length > 0 ? ' (' + watchlist.length + ')' : '')));
        })
      )
    ),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', paddingBottom: '36px' } },
      activeTab === 'smart' && (
        scoredGames.length === 0
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: '12px' } }, 'No live or upcoming games right now')
          : scoredGames.map(function(sg, i) { return renderGameCard(sg.game, i, sg.urgency, sg.reasons, sg.betRelevance); })
      ),
      activeTab === 'watchlist' && (
        !isLoggedIn
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: '12px' } }, 'Log in to use your watchlist')
          : loadingWatchlist
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: '12px' } }, 'Loading...')
          : watchlistGames.length === 0
          ? React.createElement('div', { style: { padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: '12px' } },
              React.createElement('div', { style: { fontSize: '32px', marginBottom: '12px' } }, '☆'),
              React.createElement('div', null, 'No games saved yet'),
              React.createElement('div', { style: { fontSize: '10px', marginTop: '4px' } }, 'Click ☆ on any game to save it')
            )
          : watchlistGames.map(function(game: any) { return renderGameCard(game, undefined as any, 'medium', [], []); })
      )
    )
  );
}
