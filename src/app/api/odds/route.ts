import { NextResponse } from 'next/server';

const ODDS_API_KEY = process.env.ODDS_API_KEY;

// SET TO TRUE when Odds API quota resets or plan upgraded
const USE_ODDS_API = true; // Quota exhausted - flip to true when reset

const ESPN_SPORT_MAP: Record<string, { sport: string; league: string; groups?: string }> = {
  americanfootball_nfl: { sport: 'football', league: 'nfl' },
  basketball_nba: { sport: 'basketball', league: 'nba' },
  baseball_mlb: { sport: 'baseball', league: 'mlb' },
  icehockey_nhl: { sport: 'hockey', league: 'nhl' },
  basketball_ncaab: { sport: 'basketball', league: 'mens-college-basketball', groups: '100' },
  americanfootball_ncaaf: { sport: 'football', league: 'college-football' },
  mma_mixed_martial_arts: { sport: 'mma', league: 'ufc' },
};

function normLast(name: string): string {
  return (name || '').split(' ').filter(Boolean).pop()?.toLowerCase() || '';
}

function normFull(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function americanToImplied(o: number): number {
  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

function teamsMatch(gameHome: string, gameAway: string, oddsHome: string, oddsAway: string): boolean {
  const gh = normLast(gameHome); const ga = normLast(gameAway);
  const oh = normLast(oddsHome); const oa = normLast(oddsAway);
  if (!gh || !ga || !oh || !oa) return false;
  if ((gh === oh && ga === oa) || (gh === oa && ga === oh)) return true;
  const ghf = normFull(gameHome); const gaf = normFull(gameAway);
  const ohf = normFull(oddsHome); const oaf = normFull(oddsAway);
  if ((ghf === ohf && gaf === oaf) || (ghf === oaf && gaf === ohf)) return true;
  const homeMatch = oh.includes(gh) || gh.includes(oh);
  const awayMatch = oa.includes(ga) || ga.includes(oa);
  const flipHome = oa.includes(gh) || gh.includes(oa);
  const flipAway = oh.includes(ga) || ga.includes(oh);
  return (homeMatch && awayMatch) || (flipHome && flipAway);
}

function enrichOdds(data: any[]): any[] {
  return data.map(function(game: any) {
    return {
      ...game,
      bookmakers: (game.bookmakers || []).map(function(book: any) {
        return {
          ...book,
          markets: (book.markets || []).map(function(market: any) {
            return {
              ...market,
              outcomes: (market.outcomes || []).map(function(outcome: any) {
                return { ...outcome, impliedProb: americanToImplied(outcome.price) };
              }),
            };
          }),
        };
      }),
    };
  });
}

async function fetchOddsAPI(sport: string, homeTeam: string, awayTeam: string): Promise<any[]> {
  try {
    const url = 'https://api.the-odds-api.com/v4/sports/' + sport + '/odds/?apiKey=' + ODDS_API_KEY + '&regions=us&markets=h2h,spreads,totals&oddsFormat=american';
    const res = await fetch(url, { next: { revalidate: 120 } });
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    const enriched = enrichOdds(raw);
    if (!homeTeam || !awayTeam) return enriched;
    return enriched.filter(function(game: any) {
      return teamsMatch(homeTeam, awayTeam, game.home_team, game.away_team);
    }).slice(0, 1);
  } catch { return []; }
}

async function fetchESPNOdds(sport: string, homeTeam: string, awayTeam: string): Promise<any[]> {
  const cfg = ESPN_SPORT_MAP[sport];
  if (!cfg) return [];
  try {
    const today = new Date();
    const dateStr = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
    const groupParam = cfg.groups ? '?groups=' + cfg.groups + '&dates=' + dateStr : '?dates=' + dateStr;
    const sbUrl = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/scoreboard' + groupParam;
    const sbRes = await fetch(sbUrl, { next: { revalidate: 60 } });
    const sbData = await sbRes.json();
    const events = sbData?.events || [];

    const homeLast = normLast(homeTeam);
    const awayLast = normLast(awayTeam);

    let matchedEvent: any = null;
    for (const event of events) {
      const comp = event.competitions?.[0];
      const names = (comp?.competitors || []).map(function(c: any) {
        return normLast(c.team?.displayName || c.team?.name || '');
      });
      const hasHome = names.some(function(n: string) { return n === homeLast || n.includes(homeLast) || homeLast.includes(n); });
      const hasAway = names.some(function(n: string) { return n === awayLast || n.includes(awayLast) || awayLast.includes(n); });
      if (hasHome && hasAway) { matchedEvent = event; break; }
    }
    if (!matchedEvent) return [];

    const summaryUrl = 'https://site.web.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/summary?event=' + matchedEvent.id;
    const sumRes = await fetch(summaryUrl, { next: { revalidate: 60 } });
    const sumData = await sumRes.json();
    const oddsArr = sumData?.odds || [];
    if (oddsArr.length === 0) return [];

    const comp = matchedEvent.competitions?.[0];
    const competitors = comp?.competitors || [];
    const homeComp = competitors.find(function(c: any) { return c.homeAway === 'home'; });
    const awayComp = competitors.find(function(c: any) { return c.homeAway === 'away'; });
    const homeDisplay = homeComp?.team?.displayName || homeTeam;
    const awayDisplay = awayComp?.team?.displayName || awayTeam;

    const bookmakers = oddsArr.slice(0, 6).map(function(odd: any, i: number) {
      const homeML = odd.homeTeamOdds?.moneyLine;
      const awayML = odd.awayTeamOdds?.moneyLine;
      const spread = odd.spread;
      const overUnder = odd.overUnder;
      const markets: any[] = [];
      if (homeML && awayML && homeML !== 0 && awayML !== 0) {
        markets.push({ key: 'h2h', outcomes: [
          { name: awayDisplay, price: awayML, impliedProb: americanToImplied(awayML) },
          { name: homeDisplay, price: homeML, impliedProb: americanToImplied(homeML) },
        ]});
      }
      if (spread != null) {
        const hso = odd.homeTeamOdds?.spreadOdds || -110;
        const aso = odd.awayTeamOdds?.spreadOdds || -110;
        markets.push({ key: 'spreads', outcomes: [
          { name: awayDisplay, price: aso, point: -spread, impliedProb: americanToImplied(aso) },
          { name: homeDisplay, price: hso, point: spread, impliedProb: americanToImplied(hso) },
        ]});
      }
      if (overUnder != null) {
        const oo = odd.overOdds || -110;
        const uo = odd.underOdds || -110;
        markets.push({ key: 'totals', outcomes: [
          { name: 'Over', price: oo, point: overUnder, impliedProb: americanToImplied(oo) },
          { name: 'Under', price: uo, point: overUnder, impliedProb: americanToImplied(uo) },
        ]});
      }
      return { key: 'espn_' + i, title: odd.provider?.name || 'ESPN BET', markets };
    }).filter(function(b: any) { return b.markets.length > 0; });

    if (bookmakers.length === 0) return [];
    return [{ id: matchedEvent.id, sport_key: sport, home_team: homeDisplay, away_team: awayDisplay, bookmakers }];
  } catch { return []; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'americanfootball_nfl';
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';

  if (sport === 'f1') return NextResponse.json({ odds: [] });

  // Try Odds API first if enabled and quota available
  if (USE_ODDS_API) {
    const oddsApiResult = await fetchOddsAPI(sport, homeTeam, awayTeam);
    if (oddsApiResult.length > 0) {
      return NextResponse.json({ odds: oddsApiResult, source: 'OddsAPI' });
    }
  }

  // Fall back to ESPN odds
  if (homeTeam && awayTeam) {
    const espnResult = await fetchESPNOdds(sport, homeTeam, awayTeam);
    if (espnResult.length > 0) {
      return NextResponse.json({ odds: espnResult, source: 'ESPN' });
    }
  }

  return NextResponse.json({ odds: [], source: 'none' });
}
