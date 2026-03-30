import { NextResponse } from 'next/server';

const SPORT_MAP: Record<string, { sport: string; league: string }> = {
  NBA: { sport: 'basketball', league: 'nba' },
  NFL: { sport: 'football', league: 'nfl' },
  MLB: { sport: 'baseball', league: 'mlb' },
  NHL: { sport: 'hockey', league: 'nhl' },
  NCAAB: { sport: 'basketball', league: 'mens-college-basketball' },
  NCAAF: { sport: 'football', league: 'college-football' },
};

async function fetchGameResult(league: string, gameId: string): Promise<any | null> {
  const mapped = SPORT_MAP[league.toUpperCase()];
  if (!mapped) return null;
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/' + mapped.sport + '/' + mapped.league + '/summary?event=' + gameId;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const data = await res.json();
    const comp = data?.header?.competitions?.[0];
    if (!comp) return null;
    const status = comp.status?.type?.name;
    if (status !== 'STATUS_FINAL') return null; // only settle finished games
    const competitors = comp.competitors || [];
    const home = competitors.find(function(c: any) { return c.homeAway === 'home'; });
    const away = competitors.find(function(c: any) { return c.homeAway === 'away'; });
    if (!home || !away) return null;
    return {
      homeTeam: home.team?.displayName || '',
      awayTeam: away.team?.displayName || '',
      homeScore: Number(home.score || 0),
      awayScore: Number(away.score || 0),
      isFinal: true,
    };
  } catch { return null; }
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function teamMatches(selection: string, teamName: string): boolean {
  const selNorm = normalizeName(selection);
  const teamNorm = normalizeName(teamName);
  // Check if any word from team name appears in selection
  const teamWords = teamName.toLowerCase().split(' ').filter(function(w) { return w.length > 3; });
  return selNorm.includes(teamNorm) || teamWords.some(function(w) { return selNorm.includes(w); });
}

function settleMoneyline(selection: string, result: any): 'won' | 'lost' | null {
  const homeWon = result.homeScore > result.awayScore;
  const awayWon = result.awayScore > result.homeScore;
  if (result.homeScore === result.awayScore) return null; // tie - rare
  if (teamMatches(selection, result.homeTeam)) return homeWon ? 'won' : 'lost';
  if (teamMatches(selection, result.awayTeam)) return awayWon ? 'won' : 'lost';
  return null;
}

function settleTotal(selection: string, result: any): 'won' | 'lost' | 'push' | null {
  // selection format: "Over 220.5" or "Under 45.5"
  const match = selection.match(/(over|under)\s+([\d.]+)/i);
  if (!match) return null;
  const side = match[1].toLowerCase();
  const line = parseFloat(match[2]);
  const total = result.homeScore + result.awayScore;
  if (total === line) return 'push';
  if (side === 'over') return total > line ? 'won' : 'lost';
  return total < line ? 'won' : 'lost';
}

function settleSpread(selection: string, result: any): 'won' | 'lost' | 'push' | null {
  // selection format: "Lakers -5.5" or "Chiefs +3"
  const match = selection.match(/([+-]?[\d.]+)\s*$/);
  if (!match) return null;
  const spread = parseFloat(match[1]);
  let teamScore: number, oppScore: number;
  if (teamMatches(selection, result.homeTeam)) {
    teamScore = result.homeScore; oppScore = result.awayScore;
  } else if (teamMatches(selection, result.awayTeam)) {
    teamScore = result.awayScore; oppScore = result.homeScore;
  } else { return null; }
  const margin = teamScore + spread - oppScore;
  if (margin === 0) return 'push';
  return margin > 0 ? 'won' : 'lost';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bets: any[] = body.bets || [];
    if (bets.length === 0) return NextResponse.json({ results: [] });

    // Fetch game results in parallel (deduplicated by gameId)
    const uniqueGames: Record<string, { league: string; gameId: string }> = {};
    for (const bet of bets) {
      if (bet.gameId) uniqueGames[bet.gameId] = { league: bet.league, gameId: bet.gameId };
    }
    const gameResults: Record<string, any> = {};
    await Promise.all(Object.values(uniqueGames).map(async function(g) {
      const result = await fetchGameResult(g.league, g.gameId);
      if (result) gameResults[g.gameId] = result;
    }));

    const results = bets.map(function(bet: any) {
      if (!bet.gameId || !gameResults[bet.gameId]) return { id: bet.id, result: null };
      const game = gameResults[bet.gameId];
      const betType = (bet.betType || '').toLowerCase();
      const selection = bet.selection || '';
      let result: 'won' | 'lost' | 'push' | null = null;
      if (betType === 'moneyline') result = settleMoneyline(selection, game);
      else if (betType === 'total') result = settleTotal(selection, game);
      else if (betType === 'spread') result = settleSpread(selection, game);
      return { id: bet.id, result };
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}