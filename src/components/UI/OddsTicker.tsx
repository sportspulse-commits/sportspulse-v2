'use client';

import { useState, useEffect } from 'react';
import { leagueColor, normalizeLeague, SPORT_KEYS } from '@/lib/leagues';

interface OddsTickerProps {
  games: any[];
  selectedDate: string;
  onGameSelect: (gameId: string, venueId: string, venueName: string, team: string, sport: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  oddsMap?: Record<string, any>;
  selectedSportsbook?: string;
}

interface GameOdds {
  moneyline?: { home: string; away: string };
  spread?: { home: string; away: string; homeLine: number; awayLine: number };
  total?: { over: string; under: string; line: number };
}

function toLocalDateString(utcString: string): string {
  const d = new Date(utcString);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getHeaderLabel(selectedDate: string): string {
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  if (selectedDate === todayStr) return "TODAY'S GAMES";
  const d = new Date(selectedDate + 'T12:00:00');
  return (d.getMonth() + 1) + '/' + d.getDate() + ' GAMES';
}

function getStatusLabel(game: any): { text: string; color: string } {
  const now = new Date();
  const gameTime = new Date(game.gameTime);
  if (game.status === 'final') return { text: 'FINAL', color: '#475569' };
  if (game.status === 'scheduled' || now < gameTime) {
    return { text: gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), color: '#f59e0b' };
  }
  return { text: 'LIVE', color: '#22c55e' };
}

function fmtOdds(v: any): string {
  if (v === undefined || v === null) return '-';
  const n = Number(v);
  return n > 0 ? '+' + n : '' + n;
}

function didHit(game: any, type: string, side: string, line?: number): boolean {
  if (game.status !== 'final') return false;
  const home = Number(game.homeScore);
  const away = Number(game.awayScore);
  if (type === 'ml') return side === 'home' ? home > away : away > home;
  if (type === 'spread' && line !== undefined) {
    if (side === 'home') return (home + line) > away;
    if (side === 'away') return (away + line) > home;
  }
  if (type === 'total' && line !== undefined) {
    const total = home + away;
    if (side === 'over') return total > line;
    if (side === 'under') return total < line;
  }
  return false;
}

export default function OddsTicker({ games, selectedDate, onGameSelect, onCollapsedChange, oddsMap: passedOddsMap, selectedSportsbook }: OddsTickerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const BOOK_KEY_MAP: Record<string, string> = { 'DraftKings': 'draftkings', 'FanDuel': 'fanduel', 'BetMGM': 'betmgm', 'Caesars': 'williamhill_us', 'Pinnacle': 'pinnacle', 'PointsBet': 'pointsbetus', 'Other': '' };
  const selectedBookKey = selectedSportsbook ? (BOOK_KEY_MAP[selectedSportsbook] ?? selectedSportsbook.toLowerCase()) : null;
  const [oddsMap, setOddsMap] = useState<Record<string, GameOdds>>({});
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  useEffect(function() { if (onCollapsedChange) onCollapsedChange(false); }, []);

  // Use passed odds map from page.tsx, fall back to per-game fetch
  useEffect(function() {
    if (passedOddsMap && Object.keys(passedOddsMap).length > 0) {
      // Convert passedOddsMap format to GameOdds format
      const converted: Record<string, GameOdds> = {};
      Object.entries(passedOddsMap).forEach(function([key, odd]: [string, any]) {
        const book = odd.bookmakers && (selectedBookKey ? odd.bookmakers.find(function(b: any) { return b.key === selectedBookKey; }) : odd.bookmakers[0]);
        if (!book) return;
        const h2h = book.markets && book.markets.find(function(m: any) { return m.key === 'h2h'; });
        const spreads = book.markets && book.markets.find(function(m: any) { return m.key === 'spreads'; });
        const totals = book.markets && book.markets.find(function(m: any) { return m.key === 'totals'; });
        const homeT = odd.home_team || '';
        const awayT = odd.away_team || '';
        function byName(outcomes: any, name: string) {
          return outcomes && outcomes.find(function(o: any) { return o.name === name; });
        }
        const h2hHome = byName(h2h && h2h.outcomes, homeT);
        const h2hAway = byName(h2h && h2h.outcomes, awayT);
        const sprHome = byName(spreads && spreads.outcomes, homeT);
        const sprAway = byName(spreads && spreads.outcomes, awayT);
        const totOver = totals && totals.outcomes && totals.outcomes.find(function(o: any) { return o.name === 'Over'; });
        const totUnder = totals && totals.outcomes && totals.outcomes.find(function(o: any) { return o.name === 'Under'; });
        converted[key] = {
          moneyline: h2h ? { away: fmtOdds(h2hAway && h2hAway.price), home: fmtOdds(h2hHome && h2hHome.price) } : undefined,
          spread: spreads ? { away: fmtOdds(sprAway && sprAway.price), home: fmtOdds(sprHome && sprHome.price), awayLine: sprAway && sprAway.point, homeLine: sprHome && sprHome.point } : undefined,
          total: totals ? { over: fmtOdds(totOver && totOver.price), under: fmtOdds(totUnder && totUnder.price), line: totOver && totOver.point } : undefined,
        };
      });
      setOddsMap(converted);
      return;
    }
    // Fallback: fetch per game
    if (games.length === 0) return;
    const fetchGameOdds = async function(game: any) {
      const league = normalizeLeague(game.league);
      const sport = SPORT_KEYS[league] || 'basketball_nba';
      const homeTeam = encodeURIComponent(game.homeTeam || '');
      const awayTeam = encodeURIComponent(game.awayTeam || '');
      const espnId = encodeURIComponent(game.id || '');
      try {
        const r = await fetch('/api/odds?sport=' + sport + '&homeTeam=' + homeTeam + '&awayTeam=' + awayTeam + '&espnId=' + espnId);
        const d = await r.json();
        const event = d.odds && d.odds[0];
        if (!event) return;
        const book = event.bookmakers && (selectedBookKey ? event.bookmakers.find(function(b: any) { return b.key === selectedBookKey; }) : event.bookmakers[0]);
        if (!book) return;
        const h2h = book.markets && book.markets.find(function(m: any) { return m.key === 'h2h'; });
        const spreads = book.markets && book.markets.find(function(m: any) { return m.key === 'spreads'; });
        const totals = book.markets && book.markets.find(function(m: any) { return m.key === 'totals'; });
        const homeT = event.home_team || game.homeTeam;
        const awayT = event.away_team || game.awayTeam;
        function byName(outcomes: any, name: string) {
          return outcomes && outcomes.find(function(o: any) { return o.name === name; });
        }
        const h2hHome = byName(h2h && h2h.outcomes, homeT);
        const h2hAway = byName(h2h && h2h.outcomes, awayT);
        const sprHome = byName(spreads && spreads.outcomes, homeT);
        const sprAway = byName(spreads && spreads.outcomes, awayT);
        const totOver = totals && totals.outcomes && totals.outcomes.find(function(o: any) { return o.name === 'Over'; });
        const totUnder = totals && totals.outcomes && totals.outcomes.find(function(o: any) { return o.name === 'Under'; });
        const homeKey = (game.homeTeam || '').split(' ').pop()?.toLowerCase() || '';
        const awayKey = (game.awayTeam || '').split(' ').pop()?.toLowerCase() || '';
        const teamKey = awayKey + '@' + homeKey;
        const gameOdds: GameOdds = {
          moneyline: h2h ? { away: fmtOdds(h2hAway && h2hAway.price), home: fmtOdds(h2hHome && h2hHome.price) } : undefined,
          spread: spreads ? { away: fmtOdds(sprAway && sprAway.price), home: fmtOdds(sprHome && sprHome.price), awayLine: sprAway && sprAway.point, homeLine: sprHome && sprHome.point } : undefined,
          total: totals ? { over: fmtOdds(totOver && totOver.price), under: fmtOdds(totUnder && totUnder.price), line: totOver && totOver.point } : undefined,
        };
        setOddsMap(function(prev) { return Object.assign({}, prev, { [teamKey]: gameOdds }); });
      } catch {}
    };
    games.forEach(function(game, i) {
      setTimeout(function() { fetchGameOdds(game); }, i * 200);
    });
  }, [games, passedOddsMap]);

  const todayGames = games.filter(function(g) { return toLocalDateString(g.gameTime) === selectedDate; });
  const grouped: Record<string, any[]> = {};
  for (const game of todayGames) {
    const league = normalizeLeague(game.league);
    if (!grouped[league]) grouped[league] = [];
    grouped[league].push(game);
  }


  // Sort each league: live first, then scheduled, then final
  for (const league of Object.keys(grouped)) {
    grouped[league].sort(function(a: any, b: any) {
      function order(g: any) { if (g.status === 'live') return 0; if (g.status === 'scheduled') return 1; return 2; }
      const diff = order(a) - order(b);
      if (diff !== 0) return diff;
      return new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime();
    });
  }
  const hitStyle: any = { boxShadow: '0 0 6px 2px rgba(255,255,255,0.7)', borderRadius: '3px', padding: '1px 3px', color: '#fff', fontWeight: 'bold' };
  const dimStyle: any = { color: '#94a3b8' };
  const noOddsStyle: any = { color: '#475569' };

  return (
    <div className="panel-left" style={{ position: 'fixed', left: 0, width: collapsed ? '36px' : '300px', background: '#0a0e1a', borderRight: '1px solid #1e3a5f', zIndex: 998, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', transition: 'width 0.2s ease', overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 10px', borderBottom: '1px solid #1e3a5f', minHeight: '44px' }}>
        {!collapsed && (
          <div style={{ color: '#22c55e', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' }}>
            {getHeaderLabel(selectedDate)}
          </div>
        )}
        <button onClick={function() { const next = !collapsed; setCollapsed(next); if (onCollapsedChange) onCollapsedChange(next); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '16px', padding: '0', marginLeft: collapsed ? 'auto' : '0', marginRight: collapsed ? 'auto' : '0' }}>
          {collapsed ? '>' : '<'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 60px 52px', gap: '2px', padding: '4px 10px', paddingLeft: '12px', borderBottom: '1px solid #1e3a5f', color: '#475569', fontSize: '10px', letterSpacing: '1px' }}>
          <span style={{ overflow: 'hidden' }}>MATCHUP</span>
          <span style={{ textAlign: 'center' }}>ML</span>
          <span style={{ textAlign: 'center' }}>SPREAD</span>
          <span style={{ textAlign: 'center' }}>O/U</span>
        </div>
      )}

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '36px' }}>
          {todayGames.length === 0 && (
            <div style={{ padding: '24px 16px', color: '#475569', fontSize: '12px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px' }}>No games found</div>
              <div style={{ fontSize: '10px', color: '#1e3a5f' }}>Try selecting a different date</div>
            </div>
          )}

          {Object.entries(grouped).map(function([league, leagueGames]) {
            return (
              <div key={league}>
                <div style={{ padding: '6px 10px', background: '#0f1629', color: leagueColor(league), fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', borderBottom: '1px solid #1e3a5f', borderTop: '1px solid #1e3a5f' }}>
                  {league}
                </div>
                {leagueGames.map(function(game) {
                  const status = getStatusLabel(game);
                  const odds = (function() {
                    var hk = (game.homeTeam || '').split(' ').pop().toLowerCase();
                    var ak = (game.awayTeam || '').split(' ').pop().toLowerCase();
                    return oddsMap[ak + '@' + hk];
                  }());
                  const isLive = status.text === 'LIVE';
                  const isFinal = status.text === 'FINAL';
                  const isSelected = selectedGameId === game.id;
                  const color = leagueColor(game.league);
                  const hasOdds = !!odds;

                  const mlAwayHit = hasOdds && isFinal && didHit(game, 'ml', 'away');
                  const mlHomeHit = hasOdds && isFinal && didHit(game, 'ml', 'home');
                  const spreadAwayHit = hasOdds && isFinal && odds.spread && didHit(game, 'spread', 'away', odds.spread.awayLine);
                  const spreadHomeHit = hasOdds && isFinal && odds.spread && didHit(game, 'spread', 'home', odds.spread.homeLine);
                  const overHit = hasOdds && isFinal && odds.total && didHit(game, 'total', 'over', odds.total.line);
                  const underHit = hasOdds && isFinal && odds.total && didHit(game, 'total', 'under', odds.total.line);

                  const awayName = game.awayTeam.split(' ').pop();
                  const homeName = game.homeTeam.split(' ').pop();

                  return (
                    <div
                      key={game.id}
                      onClick={function() {
                        setSelectedGameId(game.id);
                        onGameSelect(game.id, 'venue-' + game.homeTeam.toLowerCase().replace(/\s/g, '-'), game.homeTeam + ' Arena', game.homeTeam, SPORT_KEYS[league] || 'basketball_nba');
                      }}
                      style={{ padding: '8px 10px', borderBottom: '1px solid #0f1629', background: isSelected ? '#162040' : isLive ? '#0f1a2e' : 'transparent', cursor: 'pointer', borderLeft: isSelected ? '2px solid ' + color : '2px solid transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: status.color, fontSize: '10px', letterSpacing: '1px' }}>{isLive ? '● ' : ''}{status.text}</span>
                        {!hasOdds && isFinal && <span style={{ color: '#1e3a5f', fontSize: '9px' }}>no closing lines</span>}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 60px 52px', gap: '2px', fontSize: '11px' }}>
                        <span style={{ color: isFinal && Number(game.awayScore) > Number(game.homeScore) ? '#22c55e' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {awayName}{(isLive || isFinal) ? ' ' + game.awayScore : ''}
                        </span>
                        <span style={{ textAlign: 'center', ...(mlAwayHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.moneyline?.away || '-'}
                        </span>
                        <span style={{ textAlign: 'center', ...(spreadAwayHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.spread ? (odds.spread.awayLine > 0 ? '+' : '') + odds.spread.awayLine : '-'}
                        </span>
                        <span style={{ textAlign: 'center', ...(overHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.total ? 'O' + odds.total.line : '-'}
                        </span>

                        <span style={{ color: isFinal && Number(game.homeScore) > Number(game.awayScore) ? '#22c55e' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {homeName}{(isLive || isFinal) ? ' ' + game.homeScore : ''}
                        </span>
                        <span style={{ textAlign: 'center', ...(mlHomeHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.moneyline?.home || '-'}
                        </span>
                        <span style={{ textAlign: 'center', ...(spreadHomeHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.spread ? (odds.spread.homeLine > 0 ? '+' : '') + odds.spread.homeLine : '-'}
                        </span>
                        <span style={{ textAlign: 'center', ...(underHit ? hitStyle : hasOdds ? dimStyle : noOddsStyle) }}>
                          {odds?.total ? 'U' + odds.total.line : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}
