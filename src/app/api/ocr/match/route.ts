import { NextResponse } from 'next/server';

const ESPN_LEAGUES = [
  { league: 'NBA', sport: 'basketball', espnLeague: 'nba', sportKey: 'basketball_nba' },
  { league: 'NFL', sport: 'football', espnLeague: 'nfl', sportKey: 'americanfootball_nfl' },
  { league: 'MLB', sport: 'baseball', espnLeague: 'mlb', sportKey: 'baseball_mlb' },
  { league: 'NHL', sport: 'hockey', espnLeague: 'nhl', sportKey: 'icehockey_nhl' },
  { league: 'NCAAB', sport: 'basketball', espnLeague: 'mens-college-basketball', sportKey: 'basketball_ncaab', groups: '100' },
  { league: 'NCAAF', sport: 'football', espnLeague: 'college-football', sportKey: 'americanfootball_ncaaf' },
  { league: 'MMA', sport: 'mma', espnLeague: 'ufc', sportKey: 'mma_mixed_martial_arts' },
];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function teamScore(name: string, candidate: string): number {
  const n = normalizeName(name);
  const c = normalizeName(candidate);
  if (n === c) return 100;
  if (c.includes(n) || n.includes(c)) return 80;
  // Check word-by-word
  const words = name.toLowerCase().split(' ').filter(function(w) { return w.length > 3; });
  const matched = words.filter(function(w) { return c.includes(w); });
  return matched.length > 0 ? matched.length * 20 : 0;
}

async function fetchGamesForDate(date: string, leagueFilter?: string): Promise<any[]> {
  const dateStr = date.replace(/-/g, '');
  const leaguesToSearch = leagueFilter
    ? ESPN_LEAGUES.filter(function(l) { return l.league === leagueFilter.toUpperCase(); })
    : ESPN_LEAGUES;

  const results = await Promise.all(leaguesToSearch.map(async function(cfg) {
    try {
      const groupParam = (cfg as any).groups ? '&groups=' + (cfg as any).groups : '';
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.espnLeague
        + '/scoreboard?dates=' + dateStr + groupParam + '&limit=200';
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.events || []).map(function(event: any) {
        const comp = event.competitions?.[0];
        const competitors = comp?.competitors || [];
        const home = competitors.find(function(c: any) { return c.homeAway === 'home'; });
        const away = competitors.find(function(c: any) { return c.homeAway === 'away'; });
        if (!home || !away) return null;
        return {
          id: event.id,
          league: cfg.league,
          sportKey: cfg.sportKey,
          homeTeam: home.team?.displayName || '',
          awayTeam: away.team?.displayName || '',
          gameTime: event.date || '',
          status: comp?.status?.type?.name || '',
          homeScore: Number(home.score || 0),
          awayScore: Number(away.score || 0),
        };
      }).filter(Boolean);
    } catch { return []; }
  }));
  return results.flat();
}

function parseRawDate(rawDate: string): string | null {
  if (!rawDate) return null;
  // Try various formats
  const cleaned = rawDate.trim();
  
  // ISO format: 2026-03-31
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  
  // MM/DD/YYYY or M/D/YYYY
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return year + '-' + mdy[1].padStart(2,'0') + '-' + mdy[2].padStart(2,'0');
  }
  
  // MM/DD (no year — use current year)
  const md = cleaned.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const year = new Date().getFullYear();
    return year + '-' + md[1].padStart(2,'0') + '-' + md[2].padStart(2,'0');
  }

  // Month name formats: "Mar 31", "March 31, 2026", "31 Mar 2026"
  const months: Record<string, string> = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12'
  };
  const monthMatch = cleaned.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (monthMatch) {
    const mKey = monthMatch[1].toLowerCase().slice(0,3);
    const month = months[mKey];
    if (month) {
      const day = monthMatch[2].padStart(2,'0');
      const year = monthMatch[3] || String(new Date().getFullYear());
      return year + '-' + month + '-' + day;
    }
  }

  // Try native Date parsing as fallback
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  return null;
}

function todayEST(): string {
  // ESPN uses Eastern time for game dates
  const now = new Date();
  const eastern = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return eastern.getFullYear() + '-' + String(eastern.getMonth()+1).padStart(2,'0') + '-' + String(eastern.getDate()).padStart(2,'0');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeam, awayTeam, league, rawDate, selection } = body;

    // We need at least one team name or selection to match
    if (!homeTeam && !awayTeam && !selection) {
      return NextResponse.json({ gameId: null, gameDate: todayEST(), league: league || null, error: 'No team info to match' });
    }

    // Parse the date from slip, or use today
    let targetDate = rawDate ? parseRawDate(rawDate) : null;
    if (!targetDate) targetDate = todayEST();

    // Search strategy: try target date, then +1, +2, -1 days
    const datesToSearch = [
      targetDate,
      addDays(targetDate, 1),
      addDays(targetDate, 2),
      addDays(targetDate, -1),
    ];

    // Extract team names from selection if homeTeam/awayTeam not provided
    const searchHome = homeTeam || '';
    const searchAway = awayTeam || '';

    let bestMatch: any = null;
    let bestScore = 0;
    let matchDate = targetDate;

    for (const date of datesToSearch) {
      const games = await fetchGamesForDate(date, league || undefined);
      
      for (const game of games) {
        let score = 0;
        
        // Score home team match
        if (searchHome) {
          score += teamScore(searchHome, game.homeTeam);
          score += teamScore(searchHome, game.awayTeam) * 0.5; // partial credit if team switched
        }
        
        // Score away team match
        if (searchAway) {
          score += teamScore(searchAway, game.awayTeam);
          score += teamScore(searchAway, game.homeTeam) * 0.5;
        }

        // If only one team provided, check both sides
        if (!searchHome && !searchAway && selection) {
          const selNorm = normalizeName(selection);
          const homeNorm = normalizeName(game.homeTeam);
          const awayNorm = normalizeName(game.awayTeam);
          if (selNorm.includes(homeNorm.slice(0,4)) || homeNorm.includes(selNorm.slice(0,4))) score += 50;
          if (selNorm.includes(awayNorm.slice(0,4)) || awayNorm.includes(selNorm.slice(0,4))) score += 50;
        }

        // Prefer exact date match
        if (date === targetDate) score *= 1.5;

        if (score > bestScore && score >= 40) {
          bestScore = score;
          bestMatch = game;
          matchDate = date;
        }
      }

      // If we found a strong match on target date, stop searching
      if (bestMatch && date === targetDate && bestScore >= 80) break;
    }

    if (!bestMatch) {
      return NextResponse.json({
        gameId: null,
        gameDate: targetDate,
        league: league || null,
        matched: false,
      });
    }

    return NextResponse.json({
      gameId: bestMatch.id,
      gameDate: matchDate,
      league: bestMatch.league,
      sportKey: bestMatch.sportKey,
      homeTeam: bestMatch.homeTeam,
      awayTeam: bestMatch.awayTeam,
      gameTime: bestMatch.gameTime,
      status: bestMatch.status,
      homeScore: bestMatch.homeScore,
      awayScore: bestMatch.awayScore,
      matched: true,
      matchScore: bestScore,
    });

  } catch (e: any) {
    console.error('Match route error:', e?.message || e);
    return NextResponse.json({ gameId: null, gameDate: todayEST(), matched: false, error: 'Match failed' });
  }
}