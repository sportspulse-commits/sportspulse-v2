import { NextResponse } from 'next/server';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

const NBA_ABBREV: Record<string, string> = {
  'atlanta': 'ATL', 'hawks': 'ATL',
  'boston': 'BOS', 'celtics': 'BOS',
  'brooklyn': 'BRO', 'nets': 'BRO',
  'charlotte': 'CHA', 'hornets': 'CHA',
  'chicago': 'CHI', 'bulls': 'CHI',
  'cleveland': 'CLE', 'cavaliers': 'CLE',
  'dallas': 'DAL', 'mavericks': 'DAL',
  'denver': 'DEN', 'nuggets': 'DEN',
  'detroit': 'DET', 'pistons': 'DET',
  'golden': 'GSW', 'warriors': 'GSW',
  'houston': 'HOU', 'rockets': 'HOU',
  'indiana': 'IND', 'pacers': 'IND',
  'clippers': 'LAC',
  'lakers': 'LAL',
  'memphis': 'MEM', 'grizzlies': 'MEM',
  'miami': 'MIA', 'heat': 'MIA',
  'milwaukee': 'MIL', 'bucks': 'MIL',
  'minnesota': 'MIN', 'timberwolves': 'MIN',
  'orleans': 'NOP', 'pelicans': 'NOP',
  'knicks': 'NYK', 'york': 'NYK',
  'oklahoma': 'OKC', 'thunder': 'OKC',
  'orlando': 'ORL', 'magic': 'ORL',
  'philadelphia': 'PHI', '76ers': 'PHI', 'sixers': 'PHI',
  'phoenix': 'PHX', 'suns': 'PHX',
  'portland': 'POR', 'blazers': 'POR',
  'sacramento': 'SAC', 'kings': 'SAC',
  'antonio': 'SAS', 'spurs': 'SAS',
  'toronto': 'TOR', 'raptors': 'TOR',
  'utah': 'UTA', 'jazz': 'UTA',
  'washington': 'WAS', 'wizards': 'WAS',
};

const NFL_ABBREV: Record<string, string> = {
  'arizona': 'ARI', 'cardinals': 'ARI',
  'atlanta': 'ATL', 'falcons': 'ATL',
  'baltimore': 'BAL', 'ravens': 'BAL',
  'buffalo': 'BUF', 'bills': 'BUF',
  'carolina': 'CAR', 'panthers': 'CAR',
  'chicago': 'CHI', 'bears': 'CHI',
  'cincinnati': 'CIN', 'bengals': 'CIN',
  'cleveland': 'CLE', 'browns': 'CLE',
  'dallas': 'DAL', 'cowboys': 'DAL',
  'denver': 'DEN', 'broncos': 'DEN',
  'detroit': 'DET', 'lions': 'DET',
  'green': 'GNB', 'packers': 'GNB',
  'houston': 'HOU', 'texans': 'HOU',
  'indianapolis': 'IND', 'colts': 'IND',
  'jacksonville': 'JAX', 'jaguars': 'JAX',
  'kansas': 'KAN', 'chiefs': 'KAN',
  'raiders': 'LVR', 'vegas': 'LVR',
  'chargers': 'LAC',
  'rams': 'LAR',
  'miami': 'MIA', 'dolphins': 'MIA',
  'minnesota': 'MIN', 'vikings': 'MIN',
  'patriots': 'NWE', 'england': 'NWE',
  'saints': 'NOR', 'orleans': 'NOR',
  'giants': 'NYG',
  'jets': 'NYJ',
  'eagles': 'PHI', 'philadelphia': 'PHI',
  'pittsburgh': 'PIT', 'steelers': 'PIT',
  'francisco': 'SFO', '49ers': 'SFO',
  'seattle': 'SEA', 'seahawks': 'SEA',
  'buccaneers': 'TAM', 'tampa': 'TAM',
  'titans': 'TEN', 'tennessee': 'TEN',
  'commanders': 'WAS', 'washington': 'WAS',
};

function findAbbrev(teamName: string, abbrevMap: Record<string, string>): string | null {
  const lower = teamName.toLowerCase();
  for (const word of lower.split(' ')) {
    if (abbrevMap[word]) return abbrevMap[word];
  }
  for (const key of Object.keys(abbrevMap)) {
    if (lower.includes(key)) return abbrevMap[key];
  }
  return null;
}

const CHAMP_PREFIX: Record<string, string> = {
  basketball_nba: 'KXNBA-26',
  americanfootball_nfl: 'KXNFL-26',
};

const GAME_SERIES: Record<string, string> = {
  basketball_nba: 'KXNBAGAME',
  americanfootball_nfl: 'KXNFLGAME',
};

async function fetchMarket(ticker: string): Promise<any> {
  try {
    const res = await fetch(KALSHI_BASE + '/markets/' + ticker, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.market || null;
  } catch { return null; }
}

async function searchGameMarkets(series: string, homeAbbrev: string, awayAbbrev: string, gameTime: string): Promise<any[]> {
  try {
    // Search open markets for this game series, look for matching event
    const url = KALSHI_BASE + '/markets?series_ticker=' + series + '&status=open&limit=200';
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const markets = data?.markets || [];

    // Find markets whose event_ticker contains both team abbrevs
    const homeAbbrevLower = homeAbbrev.toLowerCase();
    const awayAbbrevLower = awayAbbrev.toLowerCase();
    const matched = markets.filter(function(m: any) {
      const et = (m.event_ticker || '').toLowerCase();
      return (et.includes(homeAbbrevLower) && et.includes(awayAbbrevLower));
    });
    return matched;
  } catch { return []; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';
  const sport = searchParams.get('sport') || 'basketball_nba';
  const gameTime = searchParams.get('gameTime') || new Date().toISOString();

  if (!homeTeam || !awayTeam) return NextResponse.json({ markets: [] });

  try {
    const abbrevMap = sport.includes('nfl') ? NFL_ABBREV : NBA_ABBREV;
    const homeAbbrev = findAbbrev(homeTeam, abbrevMap);
    const awayAbbrev = findAbbrev(awayTeam, abbrevMap);
    const champPrefix = CHAMP_PREFIX[sport];
    const gameSeries = GAME_SERIES[sport];
    const markets = [];

    // 1. Search for live game markets by scanning series
    if (homeAbbrev && awayAbbrev && gameSeries) {
      const gameMarkets = await searchGameMarkets(gameSeries, homeAbbrev, awayAbbrev, gameTime);
      for (const m of gameMarkets) {
        const yesBid = m.yes_bid_dollars ? Math.round(parseFloat(m.yes_bid_dollars) * 100) : null;
        const yesAsk = m.yes_ask_dollars ? Math.round(parseFloat(m.yes_ask_dollars) * 100) : null;
        const midpoint = yesBid && yesAsk ? Math.round((yesBid + yesAsk) / 2) : m.last_price_dollars ? Math.round(parseFloat(m.last_price_dollars) * 100) : null;
        const teamAbbrev = m.ticker?.split('-').pop() || '';
        const isHome = teamAbbrev === homeAbbrev;
        markets.push({
          type: 'game',
          ticker: m.ticker,
          title: m.title,
          team: isHome ? homeTeam : awayTeam,
          prob: midpoint,
          yesBid, yesAsk,
          volume: m.volume_fp,
          url: 'https://kalshi.com/markets/kxnbagame/professional-basketball-game/' + (m.event_ticker || '').toLowerCase(),
        });
      }
    }

    // 2. Championship futures
    if (champPrefix && homeAbbrev && awayAbbrev) {
      const [homeChamp, awayChamp] = await Promise.all([
        fetchMarket(champPrefix + '-' + homeAbbrev),
        fetchMarket(champPrefix + '-' + awayAbbrev),
      ]);
      for (const [m, team] of [[homeChamp, homeTeam], [awayChamp, awayTeam]] as [any, string][]) {
        if (!m) continue;
        const prob = m.yes_ask_dollars ? Math.round(parseFloat(m.yes_ask_dollars) * 100) : m.last_price_dollars ? Math.round(parseFloat(m.last_price_dollars) * 100) : null;
        markets.push({
          type: 'championship',
          ticker: m.ticker,
          title: m.title,
          team,
          championshipProb: prob,
          yesBid: m.yes_bid_dollars,
          yesAsk: m.yes_ask_dollars,
          volume: m.volume_fp,
          url: 'https://kalshi.com/markets/' + (m.event_ticker || m.ticker || '').toLowerCase().split('-')[0] + '/' + (m.event_ticker || m.ticker || '').toLowerCase(),
        });
      }
    }

    return NextResponse.json({
      markets,
      type: markets.some(function(m) { return m.type === 'game'; }) ? 'game' : 'championship'
    });

  } catch (error) {
    console.error('Kalshi error:', error);
    return NextResponse.json({ markets: [], error: String(error) });
  }
}