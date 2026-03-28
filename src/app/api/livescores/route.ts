import { NextResponse } from 'next/server';

const ESPN_LEAGUES = [
  { sportKey: 'americanfootball_nfl', sport: 'football', league: 'nfl' },
  { sportKey: 'basketball_nba', sport: 'basketball', league: 'nba' },
  { sportKey: 'baseball_mlb', sport: 'baseball', league: 'mlb' },
  { sportKey: 'icehockey_nhl', sport: 'hockey', league: 'nhl' },
  { sportKey: 'basketball_ncaab', sport: 'basketball', league: 'mens-college-basketball', groups: '100' },
  { sportKey: 'americanfootball_ncaaf', sport: 'football', league: 'college-football' },
  { sportKey: 'mma_mixed_martial_arts', sport: 'mma', league: 'ufc' },
];

function toLocalDateString(utcString: string): string {
  const d = new Date(utcString);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function fetchESPNLeague(cfg: typeof ESPN_LEAGUES[0], date: string): Promise<any[]> {
  try {
    const dateESPN = date.replace(/-/g, '');
    const groupParam = cfg.groups ? '&groups=' + cfg.groups : '';
    const url = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league
      + '/scoreboard?dates=' + dateESPN + groupParam + '&limit=200';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data?.events || [];

    return events.map(function(event: any) {
      const comp = event.competitions?.[0];
      const competitors = comp?.competitors || [];
      const home = competitors.find(function(c: any) { return c.homeAway === 'home'; });
      const away = competitors.find(function(c: any) { return c.homeAway === 'away'; });
      const statusType = comp?.status?.type?.name || '';
      const isFinal = statusType === 'STATUS_FINAL';
      const isLive = statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME';
      const isScheduled = !isFinal && !isLive;

      return {
        id: event.id,
        league: cfg.sportKey.toUpperCase(),
        homeTeam: home?.team?.displayName || '',
        awayTeam: away?.team?.displayName || '',
        homeScore: isFinal || isLive ? Number(home?.score ?? 0) : 0,
        awayScore: isFinal || isLive ? Number(away?.score ?? 0) : 0,
        status: isFinal ? 'final' : isLive ? 'live' : 'scheduled',
        gameTime: event.date || '',
        venueName: comp?.venue?.fullName || '',
        clock: comp?.status?.displayClock || '',
        period: comp?.status?.period || 0,
        statusDetail: comp?.status?.type?.shortDetail || '',
      };
    }).filter(function(g: any) {
      return g.homeTeam && g.awayTeam;
    });
  } catch { return []; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || toLocalDateString(new Date().toISOString());
  const leagues = (searchParams.get('leagues') || '').split(',').filter(Boolean);

  const leaguesToFetch = leagues.length > 0
    ? ESPN_LEAGUES.filter(function(l) { return leagues.includes(l.sportKey); })
    : ESPN_LEAGUES;

  const results = await Promise.all(
    leaguesToFetch.map(function(cfg) { return fetchESPNLeague(cfg, date); })
  );

  return NextResponse.json({ games: results.flat() });
}
