import { NextResponse } from 'next/server';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

const NBA_ABBREV: Record<string, string> = {
  'atlanta': 'ATL', 'hawks': 'ATL', 'boston': 'BOS', 'celtics': 'BOS',
  'brooklyn': 'BRO', 'nets': 'BRO', 'charlotte': 'CHA', 'hornets': 'CHA',
  'chicago': 'CHI', 'bulls': 'CHI', 'cleveland': 'CLE', 'cavaliers': 'CLE',
  'dallas': 'DAL', 'mavericks': 'DAL', 'denver': 'DEN', 'nuggets': 'DEN',
  'detroit': 'DET', 'pistons': 'DET', 'golden': 'GSW', 'warriors': 'GSW',
  'houston': 'HOU', 'rockets': 'HOU', 'indiana': 'IND', 'pacers': 'IND',
  'clippers': 'LAC', 'lakers': 'LAL', 'memphis': 'MEM', 'grizzlies': 'MEM',
  'miami': 'MIA', 'heat': 'MIA', 'milwaukee': 'MIL', 'bucks': 'MIL',
  'minnesota': 'MIN', 'timberwolves': 'MIN', 'orleans': 'NOP', 'pelicans': 'NOP',
  'knicks': 'NYK', 'york': 'NYK', 'oklahoma': 'OKC', 'thunder': 'OKC',
  'orlando': 'ORL', 'magic': 'ORL', 'philadelphia': 'PHI', '76ers': 'PHI', 'sixers': 'PHI',
  'phoenix': 'PHX', 'suns': 'PHX', 'portland': 'POR', 'blazers': 'POR',
  'sacramento': 'SAC', 'kings': 'SAC', 'antonio': 'SAS', 'spurs': 'SAS',
  'toronto': 'TOR', 'raptors': 'TOR', 'utah': 'UTA', 'jazz': 'UTA',
  'washington': 'WAS', 'wizards': 'WAS',
};

const NFL_ABBREV: Record<string, string> = {
  'arizona': 'ARI', 'cardinals': 'ARI', 'atlanta': 'ATL', 'falcons': 'ATL',
  'baltimore': 'BAL', 'ravens': 'BAL', 'buffalo': 'BUF', 'bills': 'BUF',
  'carolina': 'CAR', 'panthers': 'CAR', 'chicago': 'CHI', 'bears': 'CHI',
  'cincinnati': 'CIN', 'bengals': 'CIN', 'cleveland': 'CLE', 'browns': 'CLE',
  'dallas': 'DAL', 'cowboys': 'DAL', 'denver': 'DEN', 'broncos': 'DEN',
  'detroit': 'DET', 'lions': 'DET', 'green': 'GNB', 'packers': 'GNB',
  'houston': 'HOU', 'texans': 'HOU', 'indianapolis': 'IND', 'colts': 'IND',
  'jacksonville': 'JAX', 'jaguars': 'JAX', 'kansas': 'KAN', 'chiefs': 'KAN',
  'raiders': 'LVR', 'vegas': 'LVR', 'chargers': 'LAC', 'rams': 'LAR',
  'miami': 'MIA', 'dolphins': 'MIA', 'minnesota': 'MIN', 'vikings': 'MIN',
  'patriots': 'NWE', 'england': 'NWE', 'saints': 'NOR', 'orleans': 'NOR',
  'giants': 'NYG', 'jets': 'NYJ', 'eagles': 'PHI', 'philadelphia': 'PHI',
  'pittsburgh': 'PIT', 'steelers': 'PIT', 'francisco': 'SFO', '49ers': 'SFO',
  'seattle': 'SEA', 'seahawks': 'SEA', 'buccaneers': 'TAM', 'tampa': 'TAM',
  'titans': 'TEN', 'tennessee': 'TEN', 'commanders': 'WAS', 'washington': 'WAS',
};

const MLB_ABBREV: Record<string, string> = {
  'arizona': 'ARI', 'diamondbacks': 'ARI', 'atlanta': 'ATL', 'braves': 'ATL',
  'baltimore': 'BAL', 'orioles': 'BAL', 'boston': 'BOS', 'red': 'BOS',
  'chicago': 'CHC', 'cubs': 'CHC', 'white': 'CWS', 'sox': 'CWS',
  'cincinnati': 'CIN', 'reds': 'CIN', 'cleveland': 'CLE', 'guardians': 'CLE',
  'colorado': 'COL', 'rockies': 'COL', 'detroit': 'DET', 'tigers': 'DET',
  'houston': 'HOU', 'astros': 'HOU', 'kansas': 'KC', 'royals': 'KC',
  'angeles': 'LAD', 'dodgers': 'LAD', 'angels': 'LAA',
  'miami': 'MIA', 'marlins': 'MIA', 'milwaukee': 'MIL', 'brewers': 'MIL',
  'minnesota': 'MIN', 'twins': 'MIN', 'york': 'NYY', 'yankees': 'NYY',
  'mets': 'NYM', 'oakland': 'ATH', 'athletics': 'ATH',
  'philadelphia': 'PHI', 'phillies': 'PHI', 'pittsburgh': 'PIT', 'pirates': 'PIT',
  'diego': 'SD', 'padres': 'SD', 'san': 'SF', 'giants': 'SF',
  'seattle': 'SEA', 'mariners': 'SEA', 'louis': 'STL', 'cardinals': 'STL',
  'tampa': 'TB', 'rays': 'TB', 'texas': 'TEX', 'rangers': 'TEX',
  'toronto': 'TOR', 'blue': 'TOR', 'washington': 'WSH', 'nationals': 'WSH',
};

const NHL_ABBREV: Record<string, string> = {
  'anaheim': 'ANA', 'ducks': 'ANA', 'arizona': 'UTA', 'coyotes': 'UTA',
  'utah': 'UTA', 'hockey': 'UTA', 'boston': 'BOS', 'bruins': 'BOS',
  'buffalo': 'BUF', 'sabres': 'BUF', 'calgary': 'CGY', 'flames': 'CGY',
  'carolina': 'CAR', 'hurricanes': 'CAR', 'chicago': 'CHI', 'blackhawks': 'CHI',
  'colorado': 'COL', 'avalanche': 'COL', 'columbus': 'CBJ', 'blue': 'CBJ',
  'dallas': 'DAL', 'stars': 'DAL', 'detroit': 'DET', 'wings': 'DET',
  'edmonton': 'EDM', 'oilers': 'EDM', 'florida': 'FLA', 'panthers': 'FLA',
  'los': 'LA', 'kings': 'LA', 'minnesota': 'MIN', 'wild': 'MIN',
  'montreal': 'MTL', 'canadiens': 'MTL', 'nashville': 'NSH', 'predators': 'NSH',
  'jersey': 'NJ', 'devils': 'NJ', 'york': 'NYR', 'rangers': 'NYR',
  'islanders': 'NYI', 'ottawa': 'OTT', 'senators': 'OTT',
  'philadelphia': 'PHI', 'flyers': 'PHI', 'pittsburgh': 'PIT', 'penguins': 'PIT',
  'jose': 'SJ', 'sharks': 'SJ', 'seattle': 'SEA', 'kraken': 'SEA',
  'louis': 'STL', 'blues': 'STL', 'tampa': 'TB', 'lightning': 'TB',
  'toronto': 'TOR', 'maple': 'TOR', 'vancouver': 'VAN', 'canucks': 'VAN',
  'vegas': 'VGK', 'golden': 'VGK', 'washington': 'WSH', 'capitals': 'WSH',
  'winnipeg': 'WPG', 'jets': 'WPG',
};

const ABBREV_MAP: Record<string, Record<string, string>> = {
  basketball_nba: NBA_ABBREV,
  americanfootball_nfl: NFL_ABBREV,
  baseball_mlb: MLB_ABBREV,
  icehockey_nhl: NHL_ABBREV,
};

const CHAMP_PREFIX: Record<string, string> = {
  basketball_nba: 'KXNBA-26',
  americanfootball_nfl: 'KXNFL-26',
  baseball_mlb: 'KXMLBWS-26',
  icehockey_nhl: 'KXNHL-26',
};

const GAME_SERIES: Record<string, string> = {
  basketball_nba: 'KXNBAGAME',
  americanfootball_nfl: 'KXNFLGAME',
  baseball_mlb: 'KXMLBGAME',
  icehockey_nhl: 'KXNHLGAME',
};

const TRADE_URL_BASE: Record<string, string> = {
  basketball_nba: 'https://kalshi.com/markets/kxnbagame/professional-basketball-game/',
  americanfootball_nfl: 'https://kalshi.com/markets/kxnflgame/professional-football-game/',
  baseball_mlb: 'https://kalshi.com/markets/kxmlbgame/professional-baseball-game/',
  icehockey_nhl: 'https://kalshi.com/markets/kxnhlgame/professional-hockey-game/',
};

function findAbbrev(teamName: string, abbrevMap: Record<string, string>): string | null {
  const lower = teamName.toLowerCase();
  const sortedKeys = Object.keys(abbrevMap).sort(function(a, b) { return b.length - a.length; });
  for (const key of sortedKeys) {
    if (lower.includes(key)) return abbrevMap[key];
  }
  return null;
}

async function fetchMarket(ticker: string): Promise<any> {
  try {
    const res = await fetch(KALSHI_BASE + '/markets/' + ticker, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.market || null;
  } catch { return null; }
}

async function searchGameMarkets(series: string, homeAbbrev: string, awayAbbrev: string, gameTime: string): Promise<any[]> {
  try {
    const url = KALSHI_BASE + '/markets?series_ticker=' + series + '&status=open&limit=200';
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    const markets = data?.markets || [];
    const homeAbbrevLower = homeAbbrev.toLowerCase();
    const awayAbbrevLower = awayAbbrev.toLowerCase();
    const matched = markets.filter(function(m: any) {
      const et = (m.event_ticker || '').toLowerCase();
      return et.includes(homeAbbrevLower) && et.includes(awayAbbrevLower);
    });
    // Group by event_ticker, pick the event closest to gameTime
    const byEvent: Record<string, any[]> = {};
    for (const m of matched) { const et = m.event_ticker || 'unknown'; if (!byEvent[et]) byEvent[et] = []; byEvent[et].push(m); }
    if (Object.keys(byEvent).length === 0) return [];
    const targetTime = new Date(gameTime).getTime();
    let bestEvent = Object.keys(byEvent)[0];
    let bestDiff = Infinity;
    const MONTHS: Record<string,string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    for (const et of Object.keys(byEvent)) {
      const m = et.toLowerCase().match(/(\d{2})(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{2})/);
      if (!m) continue;
      const year = '20' + m[1]; const month = MONTHS[m[2]]; const day = m[3].padStart(2,'0');
      const d = new Date(year + '-' + month + '-' + day);
      const diff = Math.abs(d.getTime() - targetTime);
      if (diff < bestDiff) { bestDiff = diff; bestEvent = et; }
    }
    return byEvent[bestEvent] || [];
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
    const abbrevMap = ABBREV_MAP[sport] || NBA_ABBREV;
    const homeAbbrev = findAbbrev(homeTeam, abbrevMap);
    const awayAbbrev = findAbbrev(awayTeam, abbrevMap);
    const champPrefix = CHAMP_PREFIX[sport];
    const gameSeries = GAME_SERIES[sport];
    const tradeBase = TRADE_URL_BASE[sport] || TRADE_URL_BASE.basketball_nba;
    const markets = [];

    // 1. Game winner markets
    if (homeAbbrev && awayAbbrev && gameSeries) {
      const gameMarkets = await searchGameMarkets(gameSeries, homeAbbrev, awayAbbrev, gameTime);
      for (const m of gameMarkets) {
        const prob = m.last_price_dollars ? Math.round(parseFloat(m.last_price_dollars) * 100) : m.yes_bid_dollars ? Math.round(parseFloat(m.yes_bid_dollars) * 100) : null;
        const yesBid = m.yes_bid_dollars ? Math.round(parseFloat(m.yes_bid_dollars) * 100) : null;
        const yesAsk = m.yes_ask_dollars ? Math.round(parseFloat(m.yes_ask_dollars) * 100) : null;
        const teamAbbrev = (m.ticker || '').split('-').pop() || '';
        const isHome = teamAbbrev.toLowerCase() === (homeAbbrev || '').toLowerCase();
        markets.push({
          type: 'game',
          ticker: m.ticker,
          title: m.title,
          team: isHome ? homeTeam : awayTeam,
          prob: prob,
          volume: m.volume_fp,
          url: tradeBase + (m.event_ticker || '').toLowerCase(),
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
        const titleLower = (m.title || '').toLowerCase();
        const teamWords = (team as string).toLowerCase().split(' ').filter(function(w: string) { return w.length > 3; });
        const titleMatches = teamWords.some(function(w: string) { return titleLower.includes(w); });
        if (!titleMatches) continue;
        const prob = m.last_price_dollars ? Math.round(parseFloat(m.last_price_dollars) * 100) : m.yes_bid_dollars ? Math.round(parseFloat(m.yes_bid_dollars) * 100) : null;
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
    return NextResponse.json({ markets: [], error: String(error) });
  }
}
