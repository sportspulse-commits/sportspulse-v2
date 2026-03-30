'use client';
import React, { useState, useEffect } from 'react';
import WinProbGauge from './WinProbGauge';

const BROADCAST_MAP: Record<string, { network: string; url: string }[]> = {
  NBA:   [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'ABC', url: 'https://abc.com/watch-live' }, { network: 'TNT', url: 'https://www.tntdrama.com/watchtnt' }, { network: 'NBA TV', url: 'https://www.nba.com/watch' }],
  NFL:   [{ network: 'CBS', url: 'https://www.cbs.com/live-tv' }, { network: 'FOX', url: 'https://www.fox.com/live' }, { network: 'NBC', url: 'https://www.nbc.com/live' }, { network: 'ESPN', url: 'https://www.espn.com/watch' }],
  MLB:   [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'Apple TV+', url: 'https://tv.apple.com/channel/tvs.sbd.4000' }, { network: 'FOX', url: 'https://www.fox.com/live' }],
  NHL:   [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'TNT', url: 'https://www.tntdrama.com/watchtnt' }, { network: 'ABC', url: 'https://abc.com/watch-live' }],
  NCAAF: [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'ABC', url: 'https://abc.com/watch-live' }, { network: 'FOX', url: 'https://www.fox.com/live' }],
  NCAAB: [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'CBS', url: 'https://www.cbs.com/live-tv' }, { network: 'TBS', url: 'https://www.tbs.com/watchtbs' }],
  MMA:   [{ network: 'ESPN+', url: 'https://www.espn.com/watch' }, { network: 'UFC Fight Pass', url: 'https://ufcfightpass.com' }],
  F1:    [{ network: 'ESPN', url: 'https://www.espn.com/watch' }, { network: 'F1 TV', url: 'https://f1tv.formula1.com' }],
};

function getBroadcastLinks(sport: string): { network: string; url: string }[] {
  const s = sport.toUpperCase();
  if (s.includes('NBA')) return BROADCAST_MAP.NBA;
  if (s.includes('NFL')) return BROADCAST_MAP.NFL;
  if (s.includes('MLB') || s.includes('BASEBALL')) return BROADCAST_MAP.MLB;
  if (s.includes('NHL') || s.includes('HOCKEY')) return BROADCAST_MAP.NHL;
  if (s.includes('NCAAF')) return BROADCAST_MAP.NCAAF;
  if (s.includes('NCAAB')) return BROADCAST_MAP.NCAAB;
  if (s.includes('MMA') || s.includes('MARTIAL')) return BROADCAST_MAP.MMA;
  if (s.includes('F1') || s.includes('FORMULA')) return BROADCAST_MAP.F1;
  return [{ network: 'ESPN', url: 'https://www.espn.com/watch' }];
}

interface GamePanelProps {
  venueId: string;
  venueName: string;
  team: string;
  gameId: string | null;
  sport: string | null;
  onClose: () => void;
  liveGame?: any;
  passedOdds?: any;
  passedBroadcasts?: any[] | null;
}

function getGameStatus(game: any): { label: string; color: string } {
  if (!game) return { label: 'No game', color: '#475569' };
  const now = new Date();
  const gameTime = new Date(game.gameTime);
  if (game.status === 'final') return { label: 'Final', color: '#94a3b8' };
  if (game.status === 'scheduled' || now < gameTime) {
    const timeStr = gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = gameTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { label: 'Starts ' + dateStr + ' at ' + timeStr, color: '#f59e0b' };
  }
  return { label: 'LIVE', color: '#22c55e' };
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e3a5f' }}>
      <span style={{ color: '#475569', fontSize: '11px' }}>{label}</span>
      <span style={{ color: highlight ? '#22c55e' : '#e2e8f0', fontSize: '11px', fontWeight: highlight ? 'bold' : 'normal' }}>{value}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', padding: '12px 0 4px', textTransform: 'uppercase' as const }}>
      {title}
    </div>
  );
}

function StandingsSection({ standings, homeTeam, awayTeam, homeConference }: {
  standings: any[]; homeTeam: string; awayTeam: string; homeConference: string; awayConference: string;
}) {
  const initialConf = homeConference || (standings.length > 0 ? standings[0].conference : '');
  const [activeConf, setActiveConf] = React.useState(initialConf);

  const allConfs = standings
    .map(function(e) { return e.conference; })
    .filter(function(c, i, arr) { return c && arr.indexOf(c) === i; })
    .sort();
  const confs = allConfs.length > 0 ? allConfs : ['East', 'West'];
  const displayTeams = standings.filter(function(e) { return e.conference === activeConf; });

  function isHighlighted(entry: any) {
    const entryLast = (entry.team || '').toLowerCase().split(' ').filter(Boolean).pop() || '';
    const homeLast = homeTeam.toLowerCase().split(' ').filter(Boolean).pop() || '';
    const awayLast = awayTeam.toLowerCase().split(' ').filter(Boolean).pop() || '';
    if (!entryLast || entryLast.length < 4) return false;
    if (!homeLast || !awayLast) return false;
    return entryLast === homeLast || entryLast === awayLast;
  }

  return React.createElement('div', null,
    React.createElement(SectionHeader, { title: 'Conference Standings' }),
    React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } },
      [...confs].sort(function(a: string, b: string) {
        const aLow = a.toLowerCase();
        const bLow = b.toLowerCase();
        if (aLow.includes('west') || aLow.includes('afc') || aLow.includes('al') || aLow.includes('nfc')) return -1;
        if (bLow.includes('west') || bLow.includes('afc') || bLow.includes('al') || bLow.includes('nfc')) return 1;
        return a.localeCompare(b);
      }).map(function(conf: string) {
        return React.createElement('button', {
          key: conf,
          onClick: function() { setActiveConf(conf); },
          style: {
            flex: 1, padding: '5px', fontSize: '10px', fontFamily: 'monospace',
            letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px',
            border: '1px solid #1e3a5f',
            background: activeConf === conf ? '#22c55e' : '#0a0e1a',
            color: activeConf === conf ? '#000' : '#475569',
            fontWeight: activeConf === conf ? 'bold' : 'normal',
          }
        }, conf.toUpperCase());
      })
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 36px 36px 44px 44px', gap: '1px', fontSize: '10px', marginBottom: '4px' } },
      React.createElement('span', { style: { color: '#475569' } }, 'TEAM'),
      React.createElement('span', { style: { color: '#475569', textAlign: 'center' as const } }, 'W'),
      React.createElement('span', { style: { color: '#475569', textAlign: 'center' as const } }, 'L'),
      React.createElement('span', { style: { color: '#475569', textAlign: 'center' as const } }, 'PCT'),
      React.createElement('span', { style: { color: '#475569', textAlign: 'center' as const } }, 'GB')
    ),
    displayTeams.map(function(entry: any, i: number) {
      const highlight = isHighlighted(entry);
      return React.createElement('div', {
        key: i,
        style: { display: 'grid', gridTemplateColumns: '1fr 36px 36px 44px 44px', gap: '1px', padding: '4px 0', borderBottom: '1px solid #1e3a5f', background: highlight ? '#162040' : 'transparent' }
      },
        React.createElement('span', { style: { color: highlight ? '#22c55e' : '#e2e8f0', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontWeight: highlight ? 'bold' : 'normal' } }, (i + 1) + '. ' + (entry.abbreviation || entry.team)),
        React.createElement('span', { style: { color: '#e2e8f0', fontSize: '10px', textAlign: 'center' as const } }, entry.wins),
        React.createElement('span', { style: { color: '#e2e8f0', fontSize: '10px', textAlign: 'center' as const } }, entry.losses),
        React.createElement('span', { style: { color: '#94a3b8', fontSize: '10px', textAlign: 'center' as const } }, entry.pct),
        React.createElement('span', { style: { color: '#475569', fontSize: '10px', textAlign: 'center' as const } }, entry.gb || '-')
      );
    })
  );
}

export default function GamePanel({ venueId, venueName, team, gameId, sport, onClose, liveGame, passedOdds, passedBroadcasts }: GamePanelProps) {
  const [game, setGame] = useState<any>(null);
  const [odds, setOdds] = useState<any>(null);
  const [broadcasts, setBroadcasts] = useState<{ network: string; url: string; type: string }[]>([]);
  const [espnData, setEspnData] = useState<any>(null);
  const [analysis, setAnalysis] = useState('');
  const [kalshiData, setKalshiData] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [winProb, setWinProb] = useState<{ homeProb: number; awayProb: number; source: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'score' | 'overview' | 'odds' | 'ai'>('score');

  const [playerStats, setPlayerStats] = useState<any>(null);

  const [statsView, setStatsView] = useState<'home' | 'away'>('home');
  // Player stats fetch - triggers on game load (pre-game shows season avgs, live/final shows boxscore)
  useEffect(function() {
    if (!gameId || !sport || !game) return;
    fetch('/api/stats?espnId=' + gameId + '&sport=' + sport)
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.teams && d.teams.length > 0) setPlayerStats(d); })
      .catch(function() {});
  }, [gameId, sport, game?.status, game?.homeScore, game?.awayScore]);
  // 1. Sync game from liveGame prop - single source of truth from page.tsx
  useEffect(function() {
    if (!liveGame) return;
    setGame(function(prev: any) {
      if (prev && (prev.homeScore > 0 || prev.awayScore > 0) &&
          liveGame.homeScore === 0 && liveGame.awayScore === 0 &&
          liveGame.status !== 'final') {
        return Object.assign({}, prev, {
          status: liveGame.status,
          clock: liveGame.clock,
          period: liveGame.period,
          statusDetail: liveGame.statusDetail,
        });
      }
      return liveGame;
    });
  }, [liveGame]);

  // 2. Reset secondary data + fetch odds/fallback when game changes
  useEffect(function() {
    setOdds(null);
    setAnalysis('');
    setBroadcasts([]);
    setEspnData(null);
    setWinProb(null);
    if (!gameId || !sport) return;
    if (!liveGame) {
      fetch('/api/livescores?date=' + new Date().toISOString().slice(0,10) + '&leagues=' + sport)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          const found = data.games && data.games.find(function(g: any) { return g.id === gameId; });
          if (found) setGame(found);
        })
        .catch(function() {});
    }
    if (passedOdds) {
      setOdds(passedOdds);
    } else {
      fetch('/api/odds?sport=' + sport + (game ? '&homeTeam=' + encodeURIComponent(game.homeTeam || '') + '&awayTeam=' + encodeURIComponent(game.awayTeam || '') + '&espnId=' + encodeURIComponent(game.id || '') : ''))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          const found = data.odds && (
            data.odds.find(function(o: any) { return o.id === gameId; }) ||
            data.odds[0]
          );
          setOdds(found || null);
        })
        .catch(function() {});
    }
  }, [gameId, sport]);

  // 3. Win probability - updates whenever score or status changes
  useEffect(function() {
    if (!game) return;
    if (game.status === 'final') {
      const homeWon = Number(game.homeScore) > Number(game.awayScore);
      setWinProb({ homeProb: homeWon ? 100 : 0, awayProb: homeWon ? 0 : 100, source: 'Final' });
      return;
    }
    if (game.status === 'live' && sport) {
      const params = new URLSearchParams({
        homeTeam: game.homeTeam || '',
        awayTeam: game.awayTeam || '',
        sport: sport,
      });
      fetch('/api/winprob?' + params.toString())
        .then(function(r) { return r.json(); })
        .then(function(wp) { setWinProb(wp); })
        .catch(function() {});
    }
  }, [game ? game.homeScore + '-' + game.awayScore + '-' + game.status : null]);

  // 4. Win probability from odds (for upcoming games) - calculate inline, no extra fetch needed
  useEffect(function() {
    if (!game || !game.homeTeam) return;
    if (game.status === 'live' || game.status === 'final') return;
    const h2hData = odds?.bookmakers?.[0]?.markets?.find(function(m: any) { return m.key === 'h2h'; });
    if (!h2hData || !h2hData.outcomes || h2hData.outcomes.length < 2) return;
    function toProb(o: number): number {
      return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
    }
    function normLast(s: string): string {
      return (s || '').split(' ').filter(Boolean).pop()?.toLowerCase() || '';
    }
    // Match by last word of team name (handles ESPN vs OddsAPI name differences)
    const homeLast = normLast(game.homeTeam);
    const awayLast = normLast(game.awayTeam);
    let homeO = h2hData.outcomes.find(function(o: any) { return normLast(o.name) === homeLast; })?.price;
    let awayO = h2hData.outcomes.find(function(o: any) { return normLast(o.name) === awayLast; })?.price;
    // Fallback: just use first two outcomes (away=0, home=1 convention)
    if (!homeO || !awayO) {
      awayO = h2hData.outcomes[0]?.price;
      homeO = h2hData.outcomes[1]?.price;
    }
    if (!homeO || !awayO) return;
    const rawHome = toProb(homeO);
    const rawAway = toProb(awayO);
    const total = rawHome + rawAway;
    const homeProb = Math.round((rawHome / total) * 100);
    setWinProb({ homeProb, awayProb: 100 - homeProb, source: 'Implied (ML)' });
  }, [game ? game.id : null, odds]);

  // 5. Broadcast data
  useEffect(function() {
    if (passedBroadcasts) { setBroadcasts(passedBroadcasts); return; }
    if (!sport || !game || !game.homeTeam) return;
    fetch('/api/broadcast?sport=' + sport + '&homeTeam=' + encodeURIComponent(game.homeTeam) + '&awayTeam=' + encodeURIComponent(game.awayTeam))
      .then(function(r) { return r.json(); })
      .then(function(data) { setBroadcasts(data.broadcasts || []); })
      .catch(function() {});
  }, [sport, game ? game.id : null, passedBroadcasts]);

  // 6. ESPN stats + standings
  useEffect(function() {
    if (!sport || !game || !game.homeTeam) return;
    fetch('/api/espn?sport=' + sport + '&homeTeam=' + encodeURIComponent(game.homeTeam) + '&awayTeam=' + encodeURIComponent(game.awayTeam))
      .then(function(r) { return r.json(); })
      .then(function(data) { setEspnData(data); })
      .catch(function() {});
  }, [sport, game ? game.homeTeam : '']);


  // 7. Kalshi prediction market data
  useEffect(function() {
    if (!sport || !game || !game.homeTeam) return;
    const params = new URLSearchParams({
      sport: sport,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      gameTime: game.gameTime || new Date().toISOString(),
    });
    fetch('/api/kalshi?' + params.toString())
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.markets && data.markets.length > 0) setKalshiData(data); })
      .catch(function() {});
  }, [sport, game ? game.id : '']);
  function requestAnalysis() {
    if (!game) return;
    setLoadingAnalysis(true);
    setAnalysis('');
    fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, odds })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) { setAnalysis(data.analysis || 'No analysis available'); setLoadingAnalysis(false); })
      .catch(function() { setAnalysis('Analysis unavailable. Add Anthropic API credits at console.anthropic.com to enable AI insights.'); setLoadingAnalysis(false); });
  }

  const status = getGameStatus(game);
  const hasStarted = game && (game.status === 'final' || new Date() >= new Date(game.gameTime));
  const isUpcoming = game && (game.status === 'scheduled' || new Date() < new Date(game.gameTime));
  const leagueShort = sport
    ? sport.replace('americanfootball_', '').replace('basketball_', '').replace('baseball_', '').replace('icehockey_', '').toUpperCase()
    : '';

  const bestBook = odds?.bookmakers?.[0];
  const h2h = bestBook?.markets?.find(function(m: any) { return m.key === 'h2h'; });
  const spreads = bestBook?.markets?.find(function(m: any) { return m.key === 'spreads'; });
  const totals = bestBook?.markets?.find(function(m: any) { return m.key === 'totals'; });
  function fmtOdds(v: number): string { return v > 0 ? '+' + v : '' + v; }

  const tabs: Array<'score' | 'overview' | 'odds' | 'ai'> = ['score', 'overview', 'odds', 'ai'];

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, height: '100%', width: '380px', background: '#0f1629', borderLeft: '1px solid #1e3a5f', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: '#e2e8f0' }}>

      <div style={{ padding: '16px', borderBottom: '1px solid #1e3a5f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: status.color, fontSize: '11px', letterSpacing: '2px' }}>
              {status.label === 'LIVE' ? '● LIVE' : status.label}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>
              {game ? game.awayTeam + ' @ ' + game.homeTeam : team}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>{leagueShort} - {venueName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>X</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: '9px', letterSpacing: '1px' }}>WATCH ON</span>
          {broadcasts.length > 0
            ? broadcasts.map(function(b) {
                return React.createElement('a', {
                  key: b.network, href: b.url, target: '_blank', rel: 'noopener noreferrer',
                  style: { padding: '3px 10px', background: '#0a0e1a', border: '1px solid #60a5fa', color: '#60a5fa', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '1px', display: 'inline-block' }
                }, '▶ ' + b.network);
              })
            : sport
              ? getBroadcastLinks(sport).slice(0, 2).map(function(b) {
                  return React.createElement('a', {
                    key: b.network, href: b.url, target: '_blank', rel: 'noopener noreferrer',
                    style: { padding: '3px 10px', background: '#0a0e1a', border: '1px solid #1e3a5f', color: '#475569', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '1px', display: 'inline-block' }
                  }, b.network);
                })
              : null
          }
        </div>
      </div>

      {!gameId && (
        <div style={{ padding: '32px 24px', fontSize: '13px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏟</div>
          <div style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>{venueName}</div>
          <div style={{ color: '#475569' }}>No game scheduled for this date</div>
        </div>
      )}

      {game && hasStarted && (
        <div style={{ textAlign: 'center', padding: '16px 20px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', marginBottom: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>{game.awayTeam}</div>
              <div style={{ fontSize: '44px', fontWeight: 'bold', color: Number(game.awayScore) > Number(game.homeScore) ? '#22c55e' : '#e2e8f0' }}>{game.awayScore}</div>
            </div>
            <div style={{ color: '#475569', fontSize: '20px' }}>:</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>{game.homeTeam}</div>
              <div style={{ fontSize: '44px', fontWeight: 'bold', color: Number(game.homeScore) > Number(game.awayScore) ? '#22c55e' : '#e2e8f0' }}>{game.homeScore}</div>
            </div>
          </div>
          {game.status === 'live' && game.statusDetail && (
            <div style={{ color: '#22c55e', fontSize: '11px', letterSpacing: '1px', fontFamily: 'monospace' }}>
              {game.statusDetail}
            </div>
          )}
          {game.status === 'final' && (
            <div style={{ color: '#94a3b8', fontSize: '11px', letterSpacing: '1px' }}>FINAL</div>
          )}
        </div>
      )}

      {game && isUpcoming && !hasStarted && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>UPCOMING</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{game.awayTeam}</div>
          <div style={{ color: '#475569', margin: '4px 0' }}>@</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>{game.homeTeam}</div>
          <div style={{ color: '#f59e0b', fontSize: '14px' }}>
            {new Date(game.gameTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>
            {new Date(game.gameTime).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}

      {gameId && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #1e3a5f' }}>
            {tabs.map(function(tab) {
              return (
                <button key={tab} onClick={function() { setActiveTab(tab); }}
                  style={{ flex: 1, padding: '8px 4px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #22c55e' : '2px solid transparent', color: activeTab === tab ? '#22c55e' : '#475569', cursor: 'pointer', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                  {tab === 'ai' ? 'AI' : tab === 'overview' ? 'Overview' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

            {activeTab === 'score' && game && (
              <div>
                <WinProbGauge
                  homeProb={(function() { const kg = kalshiData?.markets?.find(function(m: any) { return m.type === 'game' && m.team === game.homeTeam; }); return kg ? kg.prob : winProb ? winProb.homeProb : 50; })()}
                  awayProb={(function() { const kg = kalshiData?.markets?.find(function(m: any) { return m.type === 'game' && m.team === game.awayTeam; }); return kg ? kg.prob : winProb ? winProb.awayProb : 50; })()}
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                  source={kalshiData?.markets?.some(function(m: any) { return m.type === 'game'; }) ? 'Kalshi' : winProb?.source}
                />
                {playerStats && playerStats.teams && playerStats.teams.length > 0 && (function() {
                  const isNBA = sport === 'basketball_nba' || sport === 'basketball_ncaab';
                  const isMLB = sport === 'baseball_mlb';
                  const isNHL = sport === 'icehockey_nhl';
                  const isNFL = sport === 'americanfootball_nfl' || sport === 'americanfootball_ncaaf';
                  const isSeasonAvg = playerStats.isSeasonAvg;
                  const awayTeam = playerStats.teams[0];
                  const homeTeam = playerStats.teams[1] || playerStats.teams[0];
                  const t = statsView === 'home' ? homeTeam : awayTeam;
                  if (!t) return null;
                  const starters = (t.players || []).filter(function(p: any) { return p.starter; });
                  const bench = (t.players || []).filter(function(p: any) { return !p.starter; });
                  const allPlayers = isSeasonAvg ? (t.players || []) : [...starters, ...bench];
                  // Sort season avg leaders by pts descending

                  // Column definitions per sport per mode
                  const hdNBA = isSeasonAvg ? ['GP','PTS','REB','AST','FG%','3P%','FT%'] : ['MIN','PTS','FG','3PT','REB','AST','+/-'];
                  const hdMLB = isSeasonAvg ? ['GP','AVG','HR','RBI','OBP','SLG','R'] : ['H-AB','R','RBI','HR','K','AVG','OBP'];
                  const hdNHL = isSeasonAvg ? ['GP','G','A','PTS','+/-','SOG','TOI'] : ['TOI','G','A','PTS','SOG','+/-','HIT'];
                  const hdNFL_pass = ['C/A','YDS','TD','INT','QBR'];
                  const hdNFL_rush = ['ATT','YDS','TD','YPC'];
                  const hdNFL_rec = ['REC','YDS','TD','TGT'];
                  const headers = isNBA ? hdNBA : isMLB ? hdMLB : isNHL ? hdNHL : [];
                  const colW = '32px';
                  const gridCol = isNFL ? '24px 1fr 44px 36px 28px 28px' : ('24px 1fr ' + headers.map(function() { return colW; }).join(' '));
                  function renderPlayerRow(p: any, pi: number, showDivider: boolean) {
                    const pm = p.plusMinus;
                    const pmColor = pm && pm !== '-' ? (String(pm).startsWith('-') ? '#ef4444' : '#22c55e') : '#e2e8f0';
                    return (
                      <React.Fragment key={pi}>
                        {showDivider && <div style={{ padding: '2px 16px', fontSize: '9px', color: '#1e3a5f', letterSpacing: '1px', textTransform: 'uppercase' as const, borderTop: '1px solid #1e3a5f', marginTop: '4px' }}>Bench</div>}
                        {isNFL ? (
                          <div>
                            {p.type === 'pass' && (
                              <div style={{ display: 'grid', padding: '3px 16px', fontSize: '11px', borderTop: '1px solid #0f1629', gridTemplateColumns: '24px 1fr 44px 36px 28px 28px' }}>
                                 <span style={{ color: '#475569', fontSize: '9px', textAlign: 'center' as const }}>{p.position || ''}</span>
                                 <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</span>
                                <span style={{ textAlign: 'right' as const, fontSize: '10px' }}>{p.compAtt}</span>
                                <span style={{ textAlign: 'right' as const }}>{p.yds}</span>
                                <span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.td}</span>
                                <span style={{ textAlign: 'right' as const, color: '#ef4444' }}>{p.int}</span>
                              </div>
                            )}
                            {p.type === 'rush' && (
                              <div style={{ display: 'grid', padding: '3px 16px', fontSize: '11px', borderTop: '1px solid #0f1629', gridTemplateColumns: '24px 1fr 44px 36px 28px 28px' }}>
                                 <span style={{ color: '#475569', fontSize: '9px', textAlign: 'center' as const }}>{p.position || ''}</span>
                                 <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</span>
                                <span style={{ textAlign: 'right' as const, fontSize: '10px' }}>{p.att}</span>
                                <span style={{ textAlign: 'right' as const }}>{p.yds}</span>
                                <span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.td}</span>
                                <span style={{ textAlign: 'right' as const, color: '#475569' }}>{p.ypc}</span>
                              </div>
                            )}
                            {p.type === 'rec' && (
                              <div style={{ display: 'grid', padding: '3px 16px', fontSize: '11px', borderTop: '1px solid #0f1629', gridTemplateColumns: '24px 1fr 44px 36px 28px 28px' }}>
                                 <span style={{ color: '#475569', fontSize: '9px', textAlign: 'center' as const }}>{p.position || ''}</span>
                                 <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</span>
                                <span style={{ textAlign: 'right' as const }}>{p.rec}</span>
                                <span style={{ textAlign: 'right' as const }}>{p.yds}</span>
                                <span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.td}</span>
                                <span style={{ textAlign: 'right' as const, color: '#475569' }}>{p.tgt}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', padding: '3px 16px', fontSize: '11px', borderTop: '1px solid #0f1629', gridTemplateColumns: gridCol }}>
                            <span style={{ color: '#475569', fontSize: '9px', textAlign: 'center' as const }}>{p.position || ''}</span>
                            <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.name}</span>
                            {isNBA && !isSeasonAvg && <><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.min}</span><span style={{ textAlign: 'right' as const, color: '#22c55e', fontWeight: 'bold' }}>{p.pts}</span><span style={{ textAlign: 'right' as const, fontSize: '10px' }}>{p.fg}</span><span style={{ textAlign: 'right' as const, fontSize: '10px' }}>{p.threeP}</span><span style={{ textAlign: 'right' as const }}>{p.reb}</span><span style={{ textAlign: 'right' as const }}>{p.ast}</span><span style={{ textAlign: 'right' as const, color: String(p.plusMinus).startsWith('-') ? '#ef4444' : '#22c55e' }}>{p.plusMinus}</span></>}
                            {isNBA && isSeasonAvg && <><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.gp}</span><span style={{ textAlign: 'right' as const, color: '#22c55e', fontWeight: 'bold' }}>{p.pts}</span><span style={{ textAlign: 'right' as const }}>{p.reb}</span><span style={{ textAlign: 'right' as const }}>{p.ast}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.fgPct}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.threePct}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.ftPct}</span></>}
                            {isNHL && !isSeasonAvg && <><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.toi}</span><span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.g}</span><span style={{ textAlign: 'right' as const }}>{p.a}</span><span style={{ textAlign: 'right' as const, fontWeight: 'bold' }}>{p.pts}</span><span style={{ textAlign: 'right' as const }}>{p.sog}</span><span style={{ textAlign: 'right' as const, color: String(p.plusMinus).startsWith('-') ? '#ef4444' : '#22c55e' }}>{p.plusMinus}</span><span style={{ textAlign: 'right' as const, color: '#475569' }}>{p.hits}</span></>}
                            {isNHL && isSeasonAvg && <><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.gp}</span><span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.g}</span><span style={{ textAlign: 'right' as const }}>{p.a}</span><span style={{ textAlign: 'right' as const, fontWeight: 'bold' }}>{p.pts}</span><span style={{ textAlign: 'right' as const, color: String(p.plusMinus).startsWith('-') ? '#ef4444' : p.plusMinus === '0' ? '#475569' : '#22c55e' }}>{p.plusMinus}</span><span style={{ textAlign: 'right' as const }}>{p.sog}</span><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.toi}</span></>}
                            {isMLB && !isSeasonAvg && p.type === 'batter' && <><span style={{ textAlign: 'right' as const, fontSize: '10px' }}>{p.hab}</span><span style={{ textAlign: 'right' as const }}>{p.r}</span><span style={{ textAlign: 'right' as const }}>{p.rbi}</span><span style={{ textAlign: 'right' as const }}>{p.hr}</span><span style={{ textAlign: 'right' as const }}>{p.k}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.avg}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.obp}</span></>}
                            {isMLB && !isSeasonAvg && p.type === 'pitcher' && <><span style={{ textAlign: 'right' as const }}>{p.ip}</span><span style={{ textAlign: 'right' as const }}>{p.h}</span><span style={{ textAlign: 'right' as const }}>{p.er}</span><span style={{ textAlign: 'right' as const }}>{p.bb}</span><span style={{ textAlign: 'right' as const, color: '#22c55e' }}>{p.k}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.era}</span><span style={{ textAlign: 'right' as const }}>{'-'}</span></>}
                            {isMLB && isSeasonAvg && <><span style={{ textAlign: 'right' as const, color: '#475569', fontSize: '10px' }}>{p.gp}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa', fontWeight: 'bold' }}>{p.avg}</span><span style={{ textAlign: 'right' as const }}>{p.hr}</span><span style={{ textAlign: 'right' as const }}>{p.rbi}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.obp}</span><span style={{ textAlign: 'right' as const, color: '#60a5fa' }}>{p.slg}</span><span style={{ textAlign: 'right' as const }}>{p.r}</span></>}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }
                  return (
                    <div style={{ marginTop: '12px', borderTop: '1px solid #1e3a5f', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 8px' }}>
                        <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>{isSeasonAvg ? 'Season Averages' : 'Game Stats'}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(['away', 'home'] as const).map(function(side) {
                            const label = side === 'home' ? (homeTeam?.teamName || 'Home') : (awayTeam?.teamName || 'Away');
                            return (
                              <button key={side} onClick={function() { setStatsView(side); }} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #1e3a5f', cursor: 'pointer', fontSize: '10px', fontWeight: statsView === side ? 'bold' : 'normal', background: statsView === side ? '#22c55e' : '#0a0e1a', color: statsView === side ? '#000' : '#475569' }}>{label}</button>
                            );
                          })}
                        </div>
                      </div>
                      {isSeasonAvg && allPlayers.length > 0 && (
                        <div style={{ margin: '0 16px 8px', padding: '8px', background: '#0f1629', borderRadius: '6px', border: '1px solid #1e3a5f' }}>
                          <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const }}>Season Leaders</div>
                          {isNBA && (function() {
                            const ppgLeader = [...allPlayers].sort(function(a,b){return parseFloat(b.pts||0)-parseFloat(a.pts||0);})[0];
                            const rpgLeader = [...allPlayers].sort(function(a,b){return parseFloat(b.reb||0)-parseFloat(a.reb||0);})[0];
                            const apgLeader = [...allPlayers].sort(function(a,b){return parseFloat(b.ast||0)-parseFloat(a.ast||0);})[0];
                            return (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {[{p: ppgLeader, stat: ppgLeader?.pts, label: 'PPG'}, {p: rpgLeader, stat: rpgLeader?.reb, label: 'RPG'}, {p: apgLeader, stat: apgLeader?.ast, label: 'APG'}].map(function(item, li) {
                                  return (
                                    <div key={li} style={{ flex: 1, textAlign: 'center' as const, padding: '4px', background: '#0a0e1a', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '9px', color: '#475569', marginBottom: '2px' }}>{item.label}</div>
                                      <div style={{ fontSize: '13px', color: '#22c55e', fontWeight: 'bold' }}>{item.stat}</div>
                                      <div style={{ fontSize: '9px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.p?.name}</div>
                                      <div style={{ fontSize: '9px', color: '#475569' }}>{item.p?.position}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {isNHL && (function() {
                            const ptsL = [...allPlayers].sort(function(a,b){return parseFloat(b.pts||0)-parseFloat(a.pts||0);})[0];
                            const gL = [...allPlayers].sort(function(a,b){return parseFloat(b.g||0)-parseFloat(a.g||0);})[0];
                            const aL = [...allPlayers].sort(function(a,b){return parseFloat(b.a||0)-parseFloat(a.a||0);})[0];
                            return (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {[{p: ptsL, stat: ptsL?.pts, label: 'PTS'}, {p: gL, stat: gL?.g, label: 'G'}, {p: aL, stat: aL?.a, label: 'A'}].map(function(item, li) {
                                  return (
                                    <div key={li} style={{ flex: 1, textAlign: 'center' as const, padding: '4px', background: '#0a0e1a', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '9px', color: '#475569', marginBottom: '2px' }}>{item.label}</div>
                                      <div style={{ fontSize: '13px', color: '#22c55e', fontWeight: 'bold' }}>{item.stat}</div>
                                      <div style={{ fontSize: '9px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.p?.name}</div>
                                      <div style={{ fontSize: '9px', color: '#475569' }}>{item.p?.position}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          {isMLB && (function() {
                            const avgL = [...allPlayers].sort(function(a,b){return parseFloat(b.avg||0)-parseFloat(a.avg||0);})[0];
                            const hrL = [...allPlayers].sort(function(a,b){return parseFloat(b.hr||0)-parseFloat(a.hr||0);})[0];
                            const rbiL = [...allPlayers].sort(function(a,b){return parseFloat(b.rbi||0)-parseFloat(a.rbi||0);})[0];
                            return (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {[{p: avgL, stat: avgL?.avg, label: 'AVG'}, {p: hrL, stat: hrL?.hr, label: 'HR'}, {p: rbiL, stat: rbiL?.rbi, label: 'RBI'}].map(function(item, li) {
                                  return (
                                    <div key={li} style={{ flex: 1, textAlign: 'center' as const, padding: '4px', background: '#0a0e1a', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '9px', color: '#475569', marginBottom: '2px' }}>{item.label}</div>
                                      <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 'bold' }}>{item.stat}</div>
                                      <div style={{ fontSize: '9px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.p?.name}</div>
                                      <div style={{ fontSize: '9px', color: '#475569' }}>{item.p?.position}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {!isNFL && (
                        <div style={{ display: 'grid', gridTemplateColumns: gridCol, gap: '0', padding: '0 16px 4px', fontSize: '9px', color: '#475569', borderBottom: '1px solid #1e3a5f' }}>
                          <span style={{ color: '#475569' }}>POS</span><span>PLAYER</span>
                          {(isNBA || isMLB || isNHL) && headers.map(function(h: string, hi: number) { return <span key={hi} style={{ textAlign: 'right' as const }}>{h}</span>; })}
                        </div>
                      )}




                      {isNFL && (
                        <div>
                          {['pass','rush','rec'].map(function(groupType: string) {
                            const groupPlayers = allPlayers.filter(function(p: any) { return p.type === groupType; });
                            if (groupPlayers.length === 0) return null;
                            const groupHd = groupType === 'pass' ? hdNFL_pass : groupType === 'rush' ? hdNFL_rush : hdNFL_rec;
                            const groupLabel = groupType === 'pass' ? 'Passing' : groupType === 'rush' ? 'Rushing' : 'Receiving';
                            return (
                              <div key={groupType}>
                                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 44px 36px 28px 28px', gap: '0', padding: '2px 16px 2px', fontSize: '9px', color: '#475569', borderBottom: '1px solid #1e3a5f', marginTop: '4px' }}>
                                   <span></span><span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{groupLabel}</span>
                                   {groupHd.map(function(h: string, hi: number) { return <span key={hi} style={{ textAlign: 'right' as const }}>{h}</span>; })}
                                </div>
                                {groupPlayers.map(function(p: any, pi: number) { return renderPlayerRow(p, pi, false); })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!isNFL && (
                        <div>
                          {!isSeasonAvg && starters.length > 0 && <div style={{ padding: '2px 16px', fontSize: '9px', color: '#475569', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Starters</div>}
                          {allPlayers.map(function(p: any, pi: number) {
                            const showDivider = !isSeasonAvg && starters.length > 0 && pi === starters.length;
                            return renderPlayerRow(p, pi, showDivider);
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {activeTab === 'overview' && game && (
              <div>
                <SectionHeader title="Game Info" />
                <StatRow label="Status" value={status.label} />
                <StatRow label="League" value={leagueShort} />
                <StatRow label="Game Time" value={new Date(game.gameTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                <StatRow label="Venue" value={venueName} />
                {hasStarted && (
                  <div>
                    <StatRow label="Total Points" value={String(Number(game.homeScore) + Number(game.awayScore))} />
                    <StatRow label="Point Diff" value={String(Math.abs(Number(game.homeScore) - Number(game.awayScore)))} />
                  </div>
                )}
                {espnData && espnData.awayTeam && (
                  <div>
                    <SectionHeader title={game.awayTeam + ' Season Stats'} />
                    <StatRow label="Record" value={espnData.awayTeam.record || (espnData.awayTeam.wins + '-' + espnData.awayTeam.losses)} />
                    {espnData.awayTeam.home && espnData.awayTeam.away && <StatRow label="Home / Away" value={(espnData.awayTeam.home || '') + ' / ' + (espnData.awayTeam.away || '')} />}
                    {espnData.awayTeam.pointsFor && <StatRow label="Pts/Game" value={espnData.awayTeam.pointsFor} />}
                    {espnData.awayTeam.pointsAgainst && <StatRow label="Pts Allowed" value={espnData.awayTeam.pointsAgainst} />}
                    {espnData.awayTeam.streak && <StatRow label="Streak" value={espnData.awayTeam.streak} />}
                    {espnData.awayTeam.gb && espnData.awayTeam.gb !== '0' && <StatRow label="Games Back" value={espnData.awayTeam.gb} />}
                  </div>
                )}
                {espnData && espnData.homeTeam && (
                  <div>
                    <SectionHeader title={game.homeTeam + ' Season Stats'} />
                    <StatRow label="Record" value={espnData.homeTeam.record || (espnData.homeTeam.wins + '-' + espnData.homeTeam.losses)} />
                    {espnData.homeTeam.home && espnData.homeTeam.away && <StatRow label="Home / Away" value={(espnData.homeTeam.home || '') + ' / ' + (espnData.homeTeam.away || '')} />}
                    {espnData.homeTeam.pointsFor && <StatRow label="Pts/Game" value={espnData.homeTeam.pointsFor} />}
                    {espnData.homeTeam.pointsAgainst && <StatRow label="Pts Allowed" value={espnData.homeTeam.pointsAgainst} />}
                    {espnData.homeTeam.streak && <StatRow label="Streak" value={espnData.homeTeam.streak} />}
                    {espnData.homeTeam.gb && espnData.homeTeam.gb !== '0' && <StatRow label="Games Back" value={espnData.homeTeam.gb} />}
                  </div>
                )}
                {espnData && espnData.standings && espnData.standings.length > 0 && (
                  <StandingsSection
                    standings={espnData.standings}
                    homeTeam={game.homeTeam}
                    awayTeam={game.awayTeam}
                    homeConference={espnData.homeTeam?.conference || ''}
                    awayConference={espnData.awayTeam?.conference || ''}
                  />
                )}
                {!espnData && <div style={{ color: '#475569', fontSize: '11px', textAlign: 'center' as const, padding: '16px 0' }}>Loading stats...</div>}
              </div>
            )}

            {activeTab === 'odds' && (
              <div>
                {kalshiData && kalshiData.markets && odds && (() => {
                  const gameMarkets = kalshiData.markets.filter(function(m: any) { return m.type === 'game'; });
                  const h2h = odds?.bookmakers?.[0]?.markets?.find(function(m: any) { return m.key === 'h2h'; });
                  if (gameMarkets.length > 0 && h2h) {
                    function normLast(s: string) { return (s || '').split(' ').filter(Boolean).pop()?.toLowerCase() || ''; }
                    function toProb(o: number) { return o > 0 ? 100 / (o + 100) * 100 : Math.abs(o) / (Math.abs(o) + 100) * 100; }
                    const homeKalshi = gameMarkets.find(function(m: any) { return normLast(m.team) === normLast(game?.homeTeam || ''); });
                    const homeBook = h2h.outcomes.find(function(o: any) { return normLast(o.name) === normLast(game?.homeTeam || ''); });
                    if (homeKalshi && homeBook) {
                      const kalshiPct = homeKalshi.prob;
                      const bookPct = Math.round(toProb(homeBook.price));
                      const edge = kalshiPct - bookPct;
                      if (Math.abs(edge) >= 3) {
                        return React.createElement('div', {
                          style: { background: edge > 0 ? '#0d2a1a' : '#2a0d0d', border: '1px solid ' + (edge > 0 ? '#22c55e' : '#ef4444'), borderRadius: '6px', padding: '10px 14px', marginBottom: '12px' }
                        },
                          React.createElement('div', { style: { fontSize: '10px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '4px' } }, '⚡ MARKET EDGE DETECTED'),
                          React.createElement('div', { style: { fontSize: '12px', color: edge > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' } },
                            'Kalshi: ' + kalshiPct + '% vs Books: ' + bookPct + '% → ' + (edge > 0 ? '+' : '') + edge + '% edge on ' + (game?.homeTeam || '')
                          ),
                          React.createElement('div', { style: { fontSize: '10px', color: '#475569', marginTop: '2px' } },
                            edge > 0 ? 'Prediction market implies higher probability than sportsbooks' : 'Sportsbooks imply higher probability than prediction market'
                          )
                        );
                      }
                    }
                  }
                  return null;
                })()}
                {kalshiData && kalshiData.markets && kalshiData.markets.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', letterSpacing: '2px', padding: '12px 0 8px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#22c55e' }}>◆</span> KALSHI PREDICTION MARKET
                    </div>
                    {kalshiData.markets.filter(function(m: any) { return m.type === 'game'; }).map(function(m: any) {
                      return React.createElement('div', {
                        key: m.ticker,
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e3a5f' }
                      },
                        React.createElement('div', null,
                          React.createElement('div', { style: { color: '#e2e8f0', fontSize: '12px', fontWeight: 'bold' } }, m.team),
                          React.createElement('div', { style: { color: '#475569', fontSize: '10px' } }, 'Win probability')
                        ),
                        React.createElement('div', { style: { textAlign: 'right' as const } },
                          React.createElement('div', { style: { color: '#22c55e', fontSize: '18px', fontWeight: 'bold' } }, m.prob + '%'),
                          React.createElement('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer', style: { color: '#475569', fontSize: '9px', textDecoration: 'none', letterSpacing: '1px' } }, 'TRADE ON KALSHI ↗')
                        )
                      );
                    })}
                    {kalshiData.markets.filter(function(m: any) { return m.type === 'championship'; }).length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '1px', padding: '8px 0 4px' }}>CHAMPIONSHIP FUTURES</div>
                        {kalshiData.markets.filter(function(m: any) { return m.type === 'championship'; }).map(function(m: any) {
                          return React.createElement('div', {
                            key: m.ticker,
                            style: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e3a5f' }
                          },
                            React.createElement('span', { style: { color: '#94a3b8', fontSize: '11px' } }, m.team),
                            React.createElement('div', { style: { textAlign: 'right' as const } },
                              React.createElement('span', { style: { color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' } }, m.championshipProb + '%'),
                              React.createElement('span', { style: { color: '#475569', fontSize: '10px' } }, ' title odds')
                            )
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {!odds && !kalshiData && <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>No odds available</div>}
                {odds && bestBook && (
                  <div>
                    <SectionHeader title={'Odds - ' + bestBook.title} />
                    {h2h && (
                      <div>
                        <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '1px', padding: '8px 0 4px' }}>MONEYLINE</div>
                        {game && h2h.outcomes.map(function(o: any) {
                          const label = o.name === game.homeTeam ? game.homeTeam : o.name === game.awayTeam ? game.awayTeam : o.name;
                          return React.createElement(StatRow, { key: o.name, label, value: fmtOdds(o.price) });
                        })}
                      </div>
                    )}
                    {spreads && (
                      <div>
                        <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '1px', padding: '8px 0 4px' }}>SPREAD</div>
                        {game && spreads.outcomes.map(function(o: any) {
                          const label = o.name === game.homeTeam ? game.homeTeam : o.name === game.awayTeam ? game.awayTeam : o.name;
                          const point = o.point > 0 ? '+' + o.point : '' + o.point;
                          return React.createElement(StatRow, { key: o.name, label, value: point + ' (' + fmtOdds(o.price) + ')' });
                        })}
                      </div>
                    )}
                    {totals && (
                      <div>
                        <div style={{ color: '#475569', fontSize: '10px', letterSpacing: '1px', padding: '8px 0 4px' }}>OVER / UNDER</div>
                        {totals.outcomes.map(function(o: any) {
                          return React.createElement(StatRow, { key: o.name, label: o.name + ' ' + o.point, value: fmtOdds(o.price) });
                        })}
                      </div>
                    )}
                    <SectionHeader title="All Bookmakers" />
                    {odds.bookmakers && odds.bookmakers.map(function(book: any) {
                      const bh2h = book.markets?.find(function(m: any) { return m.key === 'h2h'; });
                      if (!bh2h) return null;
                      const away = bh2h.outcomes.find(function(o: any) { return o.name === game?.awayTeam; });
                      const home = bh2h.outcomes.find(function(o: any) { return o.name === game?.homeTeam; });
                      return (
                        <div key={book.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e3a5f' }}>
                          <span style={{ color: '#475569', fontSize: '11px' }}>{book.title}</span>
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {away ? fmtOdds(away.price) : '-'} / {home ? fmtOdds(home.price) : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div>
                {!analysis && !loadingAnalysis && (
                  <button onClick={requestAnalysis}
                    style={{ width: '100%', padding: '10px', background: '#22c55e', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'monospace', fontWeight: 'bold' }}>
                    Generate Analysis
                  </button>
                )}
                {loadingAnalysis && <div style={{ color: '#94a3b8', fontSize: '12px' }}>Analyzing...</div>}
                {analysis && <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#cbd5e1', whiteSpace: 'pre-wrap' as const }}>{analysis}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
