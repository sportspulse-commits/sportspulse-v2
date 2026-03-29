'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import GamePanel from '@/components/Panel/GamePanel';
import DateSlider from '@/components/UI/DateSlider';
import OddsTicker from '@/components/UI/OddsTicker';
import NewsScroller from '@/components/UI/NewsScroller';
import BetTracker from '@/components/Betting/BetTracker';
import WatchPanel from '@/components/Watch/WatchPanel';
import SocialTracker from '@/components/UI/SocialTracker';
import { SPORT_KEYS, normalizeLeague } from '@/lib/leagues';
import UserMenu from '@/components/UI/UserMenu';

const SportMap = dynamic(function() { return import('@/components/Map/SportMap'); }, { ssr: false });

const LEAGUE_META: Record<string, { color: string; season: number[] }> = {
  NFL:   { color: '#fbbf24', season: [9,10,11,12,1,2] },
  NBA:   { color: '#60a5fa', season: [10,11,12,1,2,3,4,5,6] },
  MLB:   { color: '#f87171', season: [3,4,5,6,7,8,9,10] },
  NHL:   { color: '#c084fc', season: [10,11,12,1,2,3,4,5,6] },
  NCAAF: { color: '#fb923c', season: [8,9,10,11,12,1] },
  NCAAB: { color: '#34d399', season: [11,12,1,2,3,4] },
  MMA:   { color: '#f43f5e', season: [1,2,3,4,5,6,7,8,9,10,11,12] },
  F1:    { color: '#e11d48', season: [3,4,5,6,7,8,9,10,11] },
};

const ALL_LEAGUES = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'MMA', 'F1'];

function todayString(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getInSeasonLeagues(): string[] {
  const month = new Date().getMonth() + 1;
  return ALL_LEAGUES.filter(function(l) {
    return LEAGUE_META[l]?.season.includes(month);
  });
}

export default function Home() {
  const [activeLeagues, setActiveLeagues] = useState(getInSeasonLeagues);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [selectedVenue, setSelectedVenue] = useState<{
    venueId: string; venueName: string; team: string;
    gameId: string | null; sport: string | null;
  } | null>(null);
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [allOdds, setAllOdds] = useState<Record<string, any>>({});
  const [allBroadcasts, setAllBroadcasts] = useState<Record<string, any[]>>({});
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [showBetTracker, setShowBetTracker] = useState(false);
  const [showWatch, setShowWatch] = useState(false);
  const [tickerCollapsed, setTickerCollapsed] = useState(false);

  const [defaultSportsbook, setDefaultSportsbook] = useState('DraftKings');

  const currentMonth = new Date().getMonth() + 1;

  useEffect(function() {
    const fetchAllGames = async function() {
      const leagues = activeLeagues
        .map(function(l) { return SPORT_KEYS[l]; })
        .filter(function(k) { return k && k !== 'f1'; });
      if (leagues.length === 0) { setAllGames([]); return; }
      try {
        const res = await fetch('/api/livescores?date=' + selectedDate + '&leagues=' + leagues.join(','));
        const data = await res.json();
        setAllGames(data.games || []);
      } catch { setAllGames([]); }
    };

    fetchAllGames();
    const interval = setInterval(fetchAllGames, 15000);
    return function() { clearInterval(interval); };
  }, [activeLeagues, selectedDate]);

  // Fetch news once on mount (refreshes every 5 min)
  useEffect(function() {
    function fetchNews() {
      fetch('/api/news')
        .then(function(r) { return r.json(); })
        .then(function(d) { setNewsArticles(d.articles || []); })
        .catch(function() {});
    }
    fetchNews();
    const interval = setInterval(fetchNews, 300000);
    return function() { clearInterval(interval); };
  }, []);

  // Fetch odds for all games whenever games list changes
  useEffect(function() {
    if (allGames.length === 0) return;
    const newOdds: Record<string, any> = {};
    // Stagger fetches 200ms apart
    allGames.forEach(function(game, i) {
      const league = normalizeLeague(game.league);
      const sport = SPORT_KEYS[league];
      if (!sport || sport === 'f1') return;
      setTimeout(function() {
        const ht = encodeURIComponent(game.homeTeam || '');
        const at = encodeURIComponent(game.awayTeam || '');
        fetch('/api/odds?sport=' + sport + '&homeTeam=' + ht + '&awayTeam=' + at)
          .then(function(r) { return r.json(); })
          .then(function(d) {
            const odd = d.odds && d.odds[0];
            if (!odd) return;
            const hk = (game.homeTeam || '').split(' ').pop()?.toLowerCase() || '';
            const ak = (game.awayTeam || '').split(' ').pop()?.toLowerCase() || '';
            const key = ak + '@' + hk;
            setAllOdds(function(prev) { return Object.assign({}, prev, { [key]: odd }); });
          })
          .catch(function() {});
      }, i * 200);
    });
  }, [allGames.map(function(g) { return g.id; }).join(',')]);

  // Fetch broadcasts for live/upcoming games
  useEffect(function() {
    const liveGames = allGames.filter(function(g) { return g.status === 'live' || g.status === 'scheduled'; });
    liveGames.forEach(function(game, i) {
      const league = normalizeLeague(game.league);
      const sport = SPORT_KEYS[league];
      if (!sport) return;
      setTimeout(function() {
        fetch('/api/broadcast?sport=' + sport + '&homeTeam=' + encodeURIComponent(game.homeTeam || '') + '&awayTeam=' + encodeURIComponent(game.awayTeam || ''))
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.broadcasts && d.broadcasts.length > 0) {
              setAllBroadcasts(function(prev) { return Object.assign({}, prev, { [game.id]: d.broadcasts }); });
            }
          })
          .catch(function() {});
      }, i * 300);
    });
  }, [allGames.map(function(g) { return g.id; }).join(',')]);

  const handleVenueSelect = function(
    venueId: string, venueName: string, team: string,
    gameId: string | null, sport: string | null
  ) {
    setSelectedVenue({ venueId, venueName, team, gameId, sport });
    setHighlightedGameId(gameId);
    setShowBetTracker(false);
    setShowWatch(false);
  };

  const handleTickerGameSelect = function(
    gameId: string, venueId: string, venueName: string,
    team: string, sport: string
  ) {
    const game = allGames.find(function(g) { return g.id === gameId; });
    setSelectedVenue({
      venueId,
      venueName: (game && game.venueName) ? game.venueName : venueName,
      team: game ? game.homeTeam : team,
      gameId,
      sport,
    });
    setHighlightedGameId(gameId);
    setShowBetTracker(false);
    setShowWatch(false);
  };

  return React.createElement('main', { className: tickerCollapsed ? 'sidebar-collapsed' : '', style: { width: '100vw', height: '100vh', background: '#0a0e1a' } },
    React.createElement('style', null, '.leaflet-top.leaflet-left { left: ' + (tickerCollapsed ? '52' : '316') + 'px !important; top: 60px !important; }'),

    React.createElement(OddsTicker, {
      games: allGames,
      selectedDate: selectedDate,
      onGameSelect: handleTickerGameSelect,
      onCollapsedChange: setTickerCollapsed,
      oddsMap: allOdds,
    }),

    React.createElement('div', {
      style: { position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap' as const, justifyContent: 'center', maxWidth: '1200px', background: 'rgba(10,14,26,0.85)', padding: '6px 10px', borderRadius: '8px', backdropFilter: 'blur(8px)', border: '1px solid #1e3a5f' }
    },
      ALL_LEAGUES.map(function(league) {
        const isActive = activeLeagues.includes(league);
        const meta = LEAGUE_META[league];
        const inSeason = meta.season.includes(currentMonth);
        return React.createElement('button', {
          key: league,
          onClick: function() {
            setActiveLeagues(function(prev) {
              return prev.includes(league)
                ? prev.filter(function(l) { return l !== league; })
                : [...prev, league];
            });
          },
          style: {
            padding: '5px 12px',
            borderRadius: '4px',
            border: '1px solid ' + (isActive ? meta.color : '#1e3a5f'),
            background: isActive ? meta.color : '#0f1629',
            color: isActive ? '#000' : (inSeason ? meta.color : '#475569'),
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            letterSpacing: '1px',
            opacity: inSeason ? 1 : 0.5,
            transition: 'all 0.15s',
          }
        }, league);
      }),
      React.createElement(DateSlider, { selectedDate: selectedDate, onDateChange: setSelectedDate }),
      React.createElement('a', { href: '/analytics', style: { padding: '5px 12px', borderRadius: '4px', border: '1px solid #1e3a5f', background: '#0f1629', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px', textDecoration: 'none', display: 'inline-block' } }, 'ANALYTICS'),

      React.createElement('button', {
        onClick: function() {
          setShowBetTracker(function(prev) { return !prev; });
          setShowWatch(false);
          setSelectedVenue(null);
        },
        style: {
          padding: '5px 12px', borderRadius: '4px',
          border: '1px solid ' + (showBetTracker ? '#f59e0b' : '#1e3a5f'),
          background: showBetTracker ? '#f59e0b' : '#0f1629',
          color: showBetTracker ? '#000' : '#94a3b8',
          fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold',
          cursor: 'pointer', letterSpacing: '1px',
        }
      }, 'BETS'),
      React.createElement('button', {
        onClick: function() {
          setShowWatch(function(prev) { return !prev; });
          setShowBetTracker(false);
          setSelectedVenue(null);
        },
        style: {
          padding: '5px 12px', borderRadius: '4px',
          border: '1px solid ' + (showWatch ? '#60a5fa' : '#1e3a5f'),
          background: showWatch ? '#60a5fa' : '#0f1629',
          color: showWatch ? '#000' : '#94a3b8',
          fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold',
          cursor: 'pointer', letterSpacing: '1px',
        }
      }, 'WATCH'),

      React.createElement('select', {
        value: defaultSportsbook,
        onChange: function(e: any) { setDefaultSportsbook(e.target.value); },
        style: {
          padding: '5px 8px', borderRadius: '4px', border: '1px solid #1e3a5f',
          background: '#0f1629', color: '#94a3b8', fontFamily: 'monospace',
          fontSize: '11px', cursor: 'pointer',
        }
      },
        ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'Pinnacle', 'PointsBet', 'Other'].map(function(s) {
          return React.createElement('option', { key: s, value: s }, s);
        })
      )
    ),

    React.createElement(SportMap, {
      games: allGames,
      onVenueSelect: handleVenueSelect,
      activeLeagues: activeLeagues,
      selectedDate: selectedDate,
      highlightedGameId: highlightedGameId,
    }),

    React.createElement(NewsScroller, { articles: newsArticles }),
    React.createElement('div', { style: { position: 'fixed', top: '16px', right: selectedVenue ? '396px' : showBetTracker ? '436px' : showWatch ? '416px' : '16px', zIndex: 1002, transition: 'right 0.3s ease' } }, React.createElement(UserMenu, {})),

    selectedVenue && React.createElement(GamePanel, {
      key: selectedVenue.gameId || selectedVenue.venueId,
      venueId: selectedVenue.venueId,
      venueName: selectedVenue.venueName,
      team: selectedVenue.team,
      gameId: selectedVenue.gameId,
      sport: selectedVenue.sport,
      liveGame: selectedVenue.gameId ? allGames.find(function(g) { return g.id === selectedVenue.gameId; }) || null : null,
      passedOdds: selectedVenue.gameId ? (function() {
        const g = allGames.find(function(x) { return x.id === selectedVenue.gameId; });
        if (!g) return null;
        const hk = (g.homeTeam || '').split(' ').pop()?.toLowerCase() || '';
        const ak = (g.awayTeam || '').split(' ').pop()?.toLowerCase() || '';
        return allOdds[ak + '@' + hk] || null;
      })() : null,
      passedBroadcasts: selectedVenue.gameId ? allBroadcasts[selectedVenue.gameId] || null : null,
      onClose: function() {
        setSelectedVenue(null);
        setHighlightedGameId(null);
      },
    }),

    showBetTracker && React.createElement(BetTracker, {
      onClose: function() { setShowBetTracker(false); },
      defaultSportsbook: defaultSportsbook,
      allGames: allGames,
      allOdds: allOdds,
    }),

    showWatch && React.createElement(WatchPanel, {
      games: allGames,
      allBroadcasts: allBroadcasts,
      onClose: function() { setShowWatch(false); },
    }),
    React.createElement(SocialTracker, { games: allGames, tickerOpen: !tickerCollapsed, articles: newsArticles })
  );
}
