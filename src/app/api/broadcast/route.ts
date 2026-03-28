import { NextResponse } from 'next/server';

const SPORT_ESPN_MAP: Record<string, { sport: string; league: string }> = {
  americanfootball_nfl: { sport: 'football', league: 'nfl' },
  basketball_nba: { sport: 'basketball', league: 'nba' },
  baseball_mlb: { sport: 'baseball', league: 'mlb' },
  icehockey_nhl: { sport: 'hockey', league: 'nhl' },
  americanfootball_ncaaf: { sport: 'football', league: 'college-football' },
  basketball_ncaab: { sport: 'basketball', league: 'mens-college-basketball' },
  mma_mixed_martial_arts: { sport: 'mma', league: 'ufc' },
};

const NETWORK_URLS: Record<string, string> = {
  'ESPN': 'https://www.espn.com/watch',
  'ESPN2': 'https://www.espn.com/watch',
  'ESPN+': 'https://www.espn.com/watch',
  'ESPNU': 'https://www.espn.com/watch',
  'ABC': 'https://abc.com/watch-live',
  'NBC': 'https://www.nbc.com/live',
  'CBS': 'https://www.cbs.com/live-tv',
  'FOX': 'https://www.fox.com/live',
  'FS1': 'https://www.fox.com/live',
  'FS2': 'https://www.fox.com/live',
  'TNT': 'https://www.tntdrama.com/watchtnt',
  'TBS': 'https://www.tbs.com/watchtbs',
  'truTV': 'https://www.trutv.com/watchtrutv',
  'TruTV': 'https://www.trutv.com/watchtrutv',
  'NBA TV': 'https://www.nba.com/watch',
  'NFL Network': 'https://www.nfl.com/network/watch',
  'NHL Network': 'https://www.nhl.com/tv',
  'MLB Network': 'https://www.mlb.com/network',
  'Peacock': 'https://www.peacocktv.com',
  'Paramount+': 'https://www.paramountplus.com',
  'Apple TV+': 'https://tv.apple.com/channel/tvs.sbd.4000',
  'Amazon Prime': 'https://www.amazon.com/primevideo',
  'UFC Fight Pass': 'https://ufcfightpass.com',
  'F1 TV': 'https://f1tv.formula1.com',
  'MAX': 'https://www.max.com',
};

function getStreamUrl(network: string): string {
  if (NETWORK_URLS[network]) return NETWORK_URLS[network];
  const key = Object.keys(NETWORK_URLS).find(k => k.toLowerCase() === network.toLowerCase());
  if (key) return NETWORK_URLS[key];
  const partial = Object.keys(NETWORK_URLS).find(k =>
    network.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(network.toLowerCase())
  );
  return partial ? NETWORK_URLS[partial] : 'https://www.espn.com/watch';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'basketball_nba';
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';

  const cfg = SPORT_ESPN_MAP[sport];
  if (!cfg) return NextResponse.json({ broadcasts: [] });

  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/scoreboard';
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();
    const events = data?.events || [];

    function normalize(s: string): string {
      return s.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    const homeNorm = normalize(homeTeam);
    const awayNorm = normalize(awayTeam);

    let matchedEvent = null;
    for (const event of events) {
      const competitors = event.competitions?.[0]?.competitors || [];
      const teamNames = competitors.map(function(c: any) {
        return normalize(c.team?.displayName || c.team?.name || '');
      });
      const homeMatch = teamNames.some((n: string) => n.includes(homeNorm.slice(-6)) || homeNorm.includes(n.slice(-6)));
      const awayMatch = teamNames.some((n: string) => n.includes(awayNorm.slice(-6)) || awayNorm.includes(n.slice(-6)));
      if (homeMatch && awayMatch) { matchedEvent = event; break; }
    }

    if (!matchedEvent) return NextResponse.json({ broadcasts: [] });

    const competition = matchedEvent.competitions?.[0] || {};
    const geoBroadcasts = competition.geoBroadcasts || [];
    const broadcasts = competition.broadcasts || [];
    const networks: { network: string; url: string; type: string }[] = [];

    for (const gb of geoBroadcasts) {
      const name = gb.media?.shortName || gb.media?.callLetters || gb.media?.name || '';
      if (name && !networks.find(n => n.network === name)) {
        networks.push({ network: name, url: getStreamUrl(name), type: gb.type?.shortName || 'TV' });
      }
    }

    if (networks.length === 0) {
      for (const b of broadcasts) {
        for (const name of (b.names || [])) {
          if (name && !networks.find(n => n.network === name)) {
            networks.push({ network: name, url: getStreamUrl(name), type: 'TV' });
          }
        }
      }
    }

    if (networks.length === 0) {
      networks.push({ network: 'ESPN', url: 'https://www.espn.com/watch', type: 'Stream' });
    }

    return NextResponse.json({
      broadcasts: networks,
      eventName: matchedEvent.name || '',
      venue: matchedEvent.competitions?.[0]?.venue?.fullName || '',
    });
  } catch (error) {
    return NextResponse.json({ broadcasts: [], error: String(error) });
  }
}
