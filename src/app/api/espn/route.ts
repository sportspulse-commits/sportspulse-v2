import { NextResponse } from 'next/server';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const SPORT_ESPN_MAP: Record<string, { sport: string; league: string; groups: [string, string]; confNames: [string, string] }> = {
  americanfootball_nfl: { sport: 'football', league: 'nfl', groups: ['7', '8'], confNames: ['NFC', 'AFC'] },
  basketball_nba: { sport: 'basketball', league: 'nba', groups: ['5', '6'], confNames: ['East', 'West'] },
  baseball_mlb: { sport: 'baseball', league: 'mlb', groups: ['7', '8'], confNames: ['AL', 'NL'] },
  icehockey_nhl: { sport: 'hockey', league: 'nhl', groups: ['7', '8'], confNames: ['East', 'West'] },
  americanfootball_ncaaf: { sport: 'football', league: 'college-football', groups: ['80', '81'], confNames: ['FBS', 'FCS'] },
  basketball_ncaab: { sport: 'basketball', league: 'mens-college-basketball', groups: ['50', '55'], confNames: ['East', 'West'] },
  mma_mixed_martial_arts: { sport: 'mma', league: 'ufc', groups: ['0', '0'] as [string, string], confNames: ['', ''] as [string, string] },
};

async function fetchTeamDetail(sport: string, league: string, teamId: string): Promise<any> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/' + sport + '/' + league + '/teams/' + teamId;
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();
    const team = data?.team || {};
    const records = team?.record?.items || [];
    const overall = records.find(function(r: any) { return r.type === 'total'; });
    const home = records.find(function(r: any) { return r.type === 'home'; });
    const away = records.find(function(r: any) { return r.type === 'road'; });

    function getStat(rec: any, name: string): any {
      return rec?.stats?.find(function(s: any) { return s.name === name; })?.value;
    }

    var wins = getStat(overall, 'wins') ?? 0;
    var losses = getStat(overall, 'losses') ?? 0;
    var avgPtsFor = getStat(overall, 'avgPointsFor');
    var avgPtsAgainst = getStat(overall, 'avgPointsAgainst');
    var gb = getStat(overall, 'gamesBehind');
    var streakVal = getStat(overall, 'streak') ?? 0;
    var streak = streakVal > 0 ? 'W' + streakVal : streakVal < 0 ? 'L' + Math.abs(streakVal) : '-';
    var winPct = getStat(overall, 'winPercent') ?? 0;
    var pct = '.' + Math.round(winPct * 1000).toString().padStart(3, '0');
    var seed = getStat(overall, 'playoffSeed');

    return {
      id: team.id,
      team: team.displayName || '',
      abbreviation: team.abbreviation || '',
      record: overall?.summary || '',
      home: home?.summary || '',
      away: away?.summary || '',
      color: team.color ? '#' + team.color : '#475569',
      wins: String(wins),
      losses: String(losses),
      pct,
      pointsFor: avgPtsFor ? avgPtsFor.toFixed(1) : '',
      pointsAgainst: avgPtsAgainst ? avgPtsAgainst.toFixed(1) : '',
      gb: gb != null ? (gb === 0 ? '-' : String(gb)) : '',
      streak,
      standingSummary: team.standingSummary || '',
      seed: seed ? String(seed) : '',
    };
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'basketball_nba';
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';

  const cfg = SPORT_ESPN_MAP[sport] || SPORT_ESPN_MAP['basketball_nba'];
  const basePath = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league;

  // MMA/UFC has no standings
  if (cfg.groups[0] === '0') {
    return NextResponse.json({ homeTeam: null, awayTeam: null, standings: [] });
  }

  // College sports: return AP Top 25 rankings instead of conference standings
  if (sport === 'basketball_ncaab' || sport === 'americanfootball_ncaaf') {
    try {
      const rankingsUrl = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/rankings';
      const rankRes = await fetch(rankingsUrl, { next: { revalidate: 3600 } });
      const rankData = await rankRes.json();

      // Find AP Top 25 poll
      const polls = rankData?.rankings || [];
      const apPoll = polls.find(function(p: any) {
        return (p.name || '').toLowerCase().includes('ap') || (p.shortName || '').toLowerCase().includes('ap');
      }) || polls[0];

      const ranks = apPoll?.ranks || [];
      const standings = ranks.slice(0, 25).map(function(r: any) {
        const team = r.team || {};
        const record = r.recordSummary || '';
        const parts = record.split('-');
        return {
          id: team.id || '',
          team: team.displayName || team.name || '',
          abbreviation: team.abbreviation || '',
          seed: String(r.current || r.rank || ''),
          wins: parts[0] || '0',
          losses: parts[1] || '0',
          record,
          pct: '',
          pointsFor: '',
          pointsAgainst: '',
          streak: '',
          gb: '',
          conference: 'AP Top 25',
        };
      });

      // Also fetch the two playing teams even if not in top 25
      const teamsRes2 = await fetch(basePath + '/teams?limit=50', { next: { revalidate: 3600 } });
      const teamsData2 = await teamsRes2.json();
      const allTeams2 = teamsData2?.sports?.[0]?.leagues?.[0]?.teams || [];
      const teamIdMap2: Record<string, string> = {};
      for (const t of allTeams2) {
        if (t.team) teamIdMap2[normalizeName(t.team.displayName || '')] = t.team.id;
      }
      const homeId2 = teamIdMap2[normalizeName(homeTeam)] || Object.keys(teamIdMap2).find(k => k.includes(normalizeName(homeTeam)) || normalizeName(homeTeam).includes(k)) && teamIdMap2[Object.keys(teamIdMap2).find(k => k.includes(normalizeName(homeTeam)) || normalizeName(homeTeam).includes(k)) || ''];
      const awayId2 = teamIdMap2[normalizeName(awayTeam)] || Object.keys(teamIdMap2).find(k => k.includes(normalizeName(awayTeam)) || normalizeName(awayTeam).includes(k)) && teamIdMap2[Object.keys(teamIdMap2).find(k => k.includes(normalizeName(awayTeam)) || normalizeName(awayTeam).includes(k)) || ''];
      const [homeStats2, awayStats2] = await Promise.all([
        homeId2 ? fetchTeamDetail(cfg.sport, cfg.league, homeId2) : null,
        awayId2 ? fetchTeamDetail(cfg.sport, cfg.league, awayId2) : null,
      ]);

      return NextResponse.json({
        homeTeam: homeStats2,
        awayTeam: awayStats2,
        standings,
      });
    } catch (err) {
      return NextResponse.json({ homeTeam: null, awayTeam: null, standings: [], error: String(err) });
    }
  }

  try {
    // Fetch all teams to get IDs and conference info
    const teamsRes = await fetch(basePath + '/teams?limit=50', { next: { revalidate: 3600 } });
    const teamsData = await teamsRes.json();
    const allTeamsList = teamsData?.sports?.[0]?.leagues?.[0]?.teams || [];

    // Build ID and conference map
    const teamIdMap: Record<string, string> = {};
    const teamConfMap: Record<string, string> = {};

    for (const t of allTeamsList) {
      const team = t.team;
      if (!team) continue;
      const key = normalizeName(team.displayName || '');
      teamIdMap[key] = team.id;
    }

    // Fetch conference standings to get conference assignments
    const standingsRes = await fetch(basePath + '/standings', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }
    });
    const standingsData = await standingsRes.json();

    // Try to extract conference from standings children
    function extractConferences(node: any, confName: string) {
      if (node?.standings?.entries) {
        for (const entry of node.standings.entries) {
          const key = normalizeName(entry.team?.displayName || '');
          teamConfMap[key] = confName;
        }
      }
      if (node?.name && (node.name.includes('East') || node.name.includes('West'))) {
        confName = node.name.includes('East') ? 'East' : 'West';
      }
      for (const child of (node?.children || [])) {
        extractConferences(child, confName);
      }
    }
    extractConferences(standingsData, '');

    // Find team IDs for home and away
    const homeKey = normalizeName(homeTeam);
    const awayKey = normalizeName(awayTeam);
    const homeId = teamIdMap[homeKey] || Object.keys(teamIdMap).find(function(k) { return k.includes(homeKey) || homeKey.includes(k); }) && teamIdMap[Object.keys(teamIdMap).find(function(k) { return k.includes(homeKey) || homeKey.includes(k); }) || ''];
    const awayId = teamIdMap[awayKey] || Object.keys(teamIdMap).find(function(k) { return k.includes(awayKey) || awayKey.includes(k); }) && teamIdMap[Object.keys(teamIdMap).find(function(k) { return k.includes(awayKey) || awayKey.includes(k); }) || ''];

    // Fetch detailed stats for both teams
    const [homeStats, awayStats] = await Promise.all([
      homeId ? fetchTeamDetail(cfg.sport, cfg.league, homeId) : null,
      awayId ? fetchTeamDetail(cfg.sport, cfg.league, awayId) : null,
    ]);

    // Add conference info
    if (homeStats) homeStats.conference = teamConfMap[normalizeName(homeStats.team)] || '';
    if (awayStats) awayStats.conference = teamConfMap[normalizeName(awayStats.team)] || '';

    // Fetch standings from core API using configured groups
    const group1Teams: Set<string> = new Set();
    const group2Teams: Set<string> = new Set();

    async function getGroupTeamIds(groupId: string): Promise<string[]> {
      try {
        const url = 'https://sports.core.api.espn.com/v2/sports/' + cfg.sport + '/leagues/' + cfg.league + '/seasons/2025/types/2/groups/' + groupId + '/standings/0?lang=en&region=us';
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        return (data.standings || []).map(function(e: any) {
          const ref = e.team?.$ref || '';
          const match = ref.match(/teams\/([0-9]+)/);
          return match ? match[1] : '';
        }).filter(Boolean);
      } catch { return []; }
    }

    const [g1Ids, g2Ids] = await Promise.all([
      getGroupTeamIds(cfg.groups[0]),
      getGroupTeamIds(cfg.groups[1]),
    ]);

    g1Ids.forEach(function(id) { group1Teams.add(id); });
    g2Ids.forEach(function(id) { group2Teams.add(id); });

    // Fetch ALL team details
    const allIds = allTeamsList.map(function(t: any) { return t.team?.id; }).filter(Boolean);
    const allDetails = await Promise.all(
      allIds.map(function(id: string) { return fetchTeamDetail(cfg.sport, cfg.league, id); })
    );

    // Assign conferences using group membership
    const standingsEntries = allDetails.filter(Boolean).map(function(t: any) {
      var conf = '';
      if (group1Teams.has(t.id)) conf = cfg.confNames[0];
      else if (group2Teams.has(t.id)) conf = cfg.confNames[1];
      else conf = teamConfMap[normalizeName(t.team)] || '';
      return Object.assign({}, t, { conference: conf });
    });

    // Sort by wins desc within each conference
    standingsEntries.sort(function(a: any, b: any) {
      if (a.conference !== b.conference) return a.conference.localeCompare(b.conference);
      return parseInt(b.wins) - parseInt(a.wins);
    });

    // Assign conference to home/away stats
    if (homeStats) {
      homeStats.conference = group1Teams.has(homeStats.id) ? cfg.confNames[0] :
        group2Teams.has(homeStats.id) ? cfg.confNames[1] :
        teamConfMap[normalizeName(homeStats.team)] || cfg.confNames[0];
    }
    if (awayStats) {
      awayStats.conference = group1Teams.has(awayStats.id) ? cfg.confNames[0] :
        group2Teams.has(awayStats.id) ? cfg.confNames[1] :
        teamConfMap[normalizeName(awayStats.team)] || cfg.confNames[1];
    }

    return NextResponse.json({
      homeTeam: homeStats,
      awayTeam: awayStats,
      standings: standingsEntries,
    });

  } catch (error) {
    return NextResponse.json({ homeTeam: null, awayTeam: null, standings: [], error: String(error) }, { status: 500 });
  }
}
