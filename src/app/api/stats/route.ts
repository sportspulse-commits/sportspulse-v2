import { NextResponse } from 'next/server';

const SPORT_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba:            { sport: 'basketball', league: 'nba' },
  americanfootball_nfl:      { sport: 'football',   league: 'nfl' },
  baseball_mlb:              { sport: 'baseball',   league: 'mlb' },
  icehockey_nhl:             { sport: 'hockey',     league: 'nhl' },
  basketball_ncaab:          { sport: 'basketball', league: 'mens-college-basketball' },
  americanfootball_ncaaf:    { sport: 'football',   league: 'college-football' },
};

function gs(stats: any[], i: number): string {
  if (!stats || i < 0 || stats[i] === undefined || stats[i] === null) return '-';
  return String(stats[i]);
}

function ki(keys: string[], key: string): number { return (keys || []).indexOf(key); }

// ── NBA ──────────────────────────────────────────────────────────────────────
// names: MIN(0) PTS(1) FG(2) 3PT(3) FT(4) REB(5) AST(6) TO(7) STL(8) BLK(9) OREB(10) DREB(11) PF(12) +/-(13)
function parseBoxscoreNBA(players: any[]) {
  return players.map(function(entry: any) {
    const teamName = entry.team?.shortDisplayName || entry.team?.displayName || '';
    const stats = entry.statistics?.[0];
    const mapP = function(a: any) {
      const s = a.stats || [];
      return {
        name: a.athlete?.shortName || a.athlete?.displayName || '',
        position: a.athlete?.position?.abbreviation || '',
        starter: !!a.starter,
        min: gs(s,0), pts: gs(s,1), fg: gs(s,2), threeP: gs(s,3), ft: gs(s,4),
        reb: gs(s,5), ast: gs(s,6), stl: gs(s,8), blk: gs(s,9), to: gs(s,7), plusMinus: gs(s,13),
      };
    };
    const active = (stats?.athletes || []).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; });
    const starters = active.filter(function(a: any) { return a.starter; });
    const bench = active.filter(function(a: any) { return !a.starter; });
    return { teamName, players: [...starters.map(mapP), ...bench.map(mapP)] };
  });
}

// ── NHL ──────────────────────────────────────────────────────────────────────
// skater keys: blockedShots(0) hits(1) takeaways(2) plusMinus(3) timeOnIce(4) ... goals(9) ytdGoals(10) assists(11) shotsTotal(12) shotsMissed(13) ... faceoffsWon(15) faceoffsLost(16) faceoffPercent(17) giveaways(18) penalties(19) penaltyMinutes(20)
// goalie keys: goalsAgainst(0) shotsAgainst(1) ... saves(4) savePct(5) ... timeOnIce(9)
function parseBoxscoreNHL(players: any[]) {
  return players.map(function(entry: any) {
    const teamName = entry.team?.shortDisplayName || '';
    const skaterGroup = (entry.statistics || []).find(function(s: any) { return (s.keys||[]).includes('goals'); });
    const goalieGroup = (entry.statistics || []).find(function(s: any) { return (s.keys||[]).includes('goalsAgainst'); });
    const skaters: any[] = [];
    if (skaterGroup) {
      const active = (skaterGroup.athletes||[]).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; });
      const starters = active.filter(function(a: any) { return a.starter; });
      const bench = active.filter(function(a: any) { return !a.starter; });
      const mapS = function(a: any) {
        const s = a.stats||[];
        const g = gs(s,9), ast = gs(s,11);
        return {
          name: a.athlete?.shortName||'', position: a.athlete?.position?.abbreviation||'',
          starter: !!a.starter, type: 'skater',
          g, a: ast, pts: String((Number(g==='–'?0:g))+(Number(ast==='-'?0:ast))),
          sog: gs(s,12), plusMinus: gs(s,3), toi: gs(s,4), hits: gs(s,1), blk: gs(s,0), pim: gs(s,20),
        };
      };
      skaters.push(...starters.map(mapS), ...bench.map(mapS));
    }
    const goalies: any[] = [];
    if (goalieGroup) {
      (goalieGroup.athletes||[]).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; }).forEach(function(a: any) {
        const s = a.stats||[];
        goalies.push({
          name: a.athlete?.shortName||'', position: 'G', starter: !!a.starter, type: 'goalie',
          saves: gs(s,4), sa: gs(s,1), svPct: gs(s,5), ga: gs(s,0), toi: gs(s,9),
        });
      });
    }
    return { teamName, players: [...skaters, ...goalies] };
  });
}

// ── MLB ──────────────────────────────────────────────────────────────────────
// batting keys: hits-atBats(0) atBats(1) runs(2) hits(3) RBIs(4) homeRuns(5) walks(6) strikeouts(7) pitches(8) avg(9) onBasePct(10) slugAvg(11)
// pitching keys: fullInnings.partInnings(0) hits(1) runs(2) earnedRuns(3) walks(4) strikeouts(5) homeRuns(6) pitches-strikes(7) ERA(8) pitches(9)
function parseBoxscoreMLB(players: any[]) {
  return players.map(function(entry: any) {
    const teamName = entry.team?.shortDisplayName || '';
    const battingGroup = (entry.statistics||[]).find(function(s: any) { return (s.keys||[]).includes('atBats'); });
    const pitchingGroup = (entry.statistics||[]).find(function(s: any) { return (s.keys||[]).includes('ERA'); });
    const batters: any[] = [];
    if (battingGroup) {
      const active = (battingGroup.athletes||[]).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; });
      const starters = active.filter(function(a: any) { return a.starter; });
      const bench = active.filter(function(a: any) { return !a.starter; });
      const mapB = function(a: any) {
        const s = a.stats||[];
        return {
          name: a.athlete?.shortName||'', position: a.athlete?.position?.abbreviation||'',
          starter: !!a.starter, type: 'batter',
          hab: gs(s,0), ab: gs(s,1), r: gs(s,2), h: gs(s,3), rbi: gs(s,4),
          hr: gs(s,5), bb: gs(s,6), k: gs(s,7), avg: gs(s,9), obp: gs(s,10), slg: gs(s,11),
        };
      };
      batters.push(...starters.map(mapB), ...bench.map(mapB));
    }
    const pitchers: any[] = [];
    if (pitchingGroup) {
      (pitchingGroup.athletes||[]).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; }).forEach(function(a: any) {
        const s = a.stats||[];
        pitchers.push({
          name: a.athlete?.shortName||'', position: 'P', starter: !!a.starter, type: 'pitcher',
          ip: gs(s,0), h: gs(s,1), r: gs(s,2), er: gs(s,3), bb: gs(s,4), k: gs(s,5), hr: gs(s,6), era: gs(s,8),
        });
      });
    }
    return { teamName, players: [...batters, ...pitchers] };
  });
}

// ── NFL ──────────────────────────────────────────────────────────────────────
function parseBoxscoreNFL(players: any[]) {
  return players.map(function(entry: any) {
    const teamName = entry.team?.shortDisplayName || '';
    const groups: Record<string,any> = {};
    (entry.statistics||[]).forEach(function(s: any) { groups[s.name] = s; });
    const result: any[] = [];
    const addGroup = function(groupName: string, type: string, mapFn: (a: any) => any) {
      const g = groups[groupName];
      if (!g) return;
      (g.athletes||[]).filter(function(a: any) { return !a.didNotPlay && a.stats?.length > 0; }).slice(0,3).forEach(function(a: any) {
        result.push(mapFn(a));
      });
    };
    addGroup('passing', 'pass', function(a: any) {
      const s = a.stats||[];
      return { name: a.athlete?.shortName||'', position: a.athlete?.position?.abbreviation||'', starter: !!a.starter, type: 'pass', compAtt: gs(s,0), yds: gs(s,1), td: gs(s,3), int: gs(s,4), qbr: gs(s,7) };
    });
    addGroup('rushing', 'rush', function(a: any) {
      const s = a.stats||[];
      return { name: a.athlete?.shortName||'', position: a.athlete?.position?.abbreviation||'', starter: !!a.starter, type: 'rush', att: gs(s,0), yds: gs(s,1), ypc: gs(s,2), td: gs(s,3) };
    });
    addGroup('receiving', 'rec', function(a: any) {
      const s = a.stats||[];
      return { name: a.athlete?.shortName||'', position: a.athlete?.position?.abbreviation||'', starter: !!a.starter, type: 'rec', rec: gs(s,0), yds: gs(s,1), td: gs(s,3), tgt: gs(s,5) };
    });
    return { teamName, players: result };
  });
}

// ── Season averages ──────────────────────────────────────────────────────────
async function fetchNBASeasonAvg(sport: string, league: string, athleteId: string, name: string, position: string): Promise<any> {
  try {
    const res = await fetch('https://site.api.espn.com/apis/common/v3/sports/' + sport + '/' + league + '/athletes/' + athleteId + '/stats', { next: { revalidate: 3600 } });
    const data = await res.json();
    const cat = (data.categories||[]).find(function(c: any) { return c.name === 'averages'; });
    if (!cat) return null;
    const stats = cat.statistics||[];
    const s = (stats[stats.length-1]||{}).stats;
    if (!s) return null;
    // GP(0) GS(1) MIN(2) FG(3) FG%(4) 3PT(5) 3P%(6) FT(7) FT%(8) OR(9) DR(10) REB(11) AST(12) BLK(13) STL(14) PF(15) TO(16) PTS(17)
    return { id: athleteId, name, position, starter: false, isSeasonAvg: true,
      gp: gs(s,0), min: gs(s,2), pts: gs(s,17), reb: gs(s,11), ast: gs(s,12), stl: gs(s,14), blk: gs(s,13),
      fg: gs(s,3), fgPct: gs(s,4), threeP: gs(s,5), threePct: gs(s,6), ft: gs(s,7), ftPct: gs(s,8) };
  } catch { return null; }
}

async function fetchNHLSeasonAvg(nhlId: string, name: string, position: string): Promise<any> {
  try {
    const res = await fetch('https://api-web.nhle.com/v1/player/' + nhlId + '/landing', { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const s = data?.featuredStats?.regularSeason?.subSeason;
    if (!s) return null;
    return { id: nhlId, name, position, starter: false, isSeasonAvg: true, type: 'skater',
      gp: String(s.gamesPlayed||0), g: String(s.goals||0), a: String(s.assists||0), pts: String(s.points||0),
      plusMinus: String(s.plusMinus||0), pim: String(s.pim||0), sog: String(s.shots||0), toi: '-' };
  } catch { return null; }
}

async function fetchMLBSeasonAvg(athleteId: string, name: string, position: string): Promise<any> {
  try {
    const res = await fetch('https://site.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/' + athleteId + '/stats', { next: { revalidate: 3600 } });
    const data = await res.json();
    const cat = (data.categories||[]).find(function(c: any) { return (c.name||'').includes('batting'); }) || (data.categories||[])[0];
    if (!cat) return null;
    const stats = cat.statistics||[];
    const s = (stats[stats.length-1]||{}).stats;
    if (!s) return null;
    const labels: string[] = (cat.labels||'').split(' ');
    const abi = labels.indexOf('AB'), hi = labels.indexOf('H'), hri = labels.indexOf('HR');
    const rbii = labels.indexOf('RBI'), avgi = labels.indexOf('AVG'), obpi = labels.indexOf('OBP'), slgi = labels.indexOf('SLG');
    const ri = labels.indexOf('R'), gpi = labels.indexOf('GP');
    return { id: athleteId, name, position, starter: false, isSeasonAvg: true, type: 'batter',
      gp: gpi>=0?gs(s,gpi):'-', ab: abi>=0?gs(s,abi):'-', r: ri>=0?gs(s,ri):'-', h: hi>=0?gs(s,hi):'-',
      hr: hri>=0?gs(s,hri):'-', rbi: rbii>=0?gs(s,rbii):'-', avg: avgi>=0?gs(s,avgi):'-',
      obp: obpi>=0?gs(s,obpi):'-', slg: slgi>=0?gs(s,slgi):'-' };
  } catch { return null; }
}

async function fetchNHLRosterStats(teamAbbrev: string, teamName: string): Promise<any> {
  try {
    const res = await fetch('https://api-web.nhle.com/v1/roster/' + teamAbbrev + '/20252026', { next: { revalidate: 3600 } });
    if (!res.ok) return { teamName, players: [], isSeasonAvg: true };
    const data = await res.json();
    const allPlayers = [...(data.forwards||[]), ...(data.defensemen||[])].slice(0, 15);
    const results = await Promise.all(allPlayers.map(function(p: any) {
      const name = (p.firstName?.default||'') + ' ' + (p.lastName?.default||'');
      const shortName = (p.firstName?.default||'')[0] + '. ' + (p.lastName?.default||'');
      return fetchNHLSeasonAvg(String(p.id), shortName, p.positionCode||'');
    }));
    const players = results.filter(Boolean).sort(function(a: any, b: any) { return parseFloat(b.pts||0) - parseFloat(a.pts||0); }).slice(0, 10);
    return { teamName, players, isSeasonAvg: true };
  } catch { return { teamName, players: [], isSeasonAvg: true }; }
}

async function fetchPreGameStats(sport: string, league: string, homeTeamId: string, awayTeamId: string, sportKey: string, homeAbbrev?: string, awayAbbrev?: string) {
  if (sportKey === 'icehockey_nhl' && homeAbbrev && awayAbbrev) {
    const [homeStats, awayStats] = await Promise.all([
      fetchNHLRosterStats(homeAbbrev, homeAbbrev),
      fetchNHLRosterStats(awayAbbrev, awayAbbrev),
    ]);
    return [awayStats, homeStats];
  }
  const [homeRoster, awayRoster] = await Promise.all([
    fetch('https://site.api.espn.com/apis/site/v2/sports/' + sport + '/' + league + '/teams/' + homeTeamId + '/roster', { next: { revalidate: 3600 } }).then(function(r) { return r.json(); }).catch(function() { return { athletes: [] }; }),
    fetch('https://site.api.espn.com/apis/site/v2/sports/' + sport + '/' + league + '/teams/' + awayTeamId + '/roster', { next: { revalidate: 3600 } }).then(function(r) { return r.json(); }).catch(function() { return { athletes: [] }; }),
  ]);
  async function getRosterStats(roster: any, teamName: string) {
    const rawAthletes = roster.athletes || [];
    const athletes = rawAthletes.length > 0 && rawAthletes[0].items ? rawAthletes.flatMap(function(g: any) { return g.items || []; }).slice(0, 20) : rawAthletes.slice(0, 20);
    let playerStats: any[] = [];
    if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
      const results = await Promise.all(athletes.map(function(a: any) { return fetchNBASeasonAvg(sport, league, a.id, a.shortName||a.displayName, a.position?.abbreviation||''); }));
      playerStats = results.filter(Boolean).sort(function(a: any, b: any) { return parseFloat(b.min||0) - parseFloat(a.min||0); }).slice(0, 10);
    } else if (sportKey === 'baseball_mlb') {
      const results = await Promise.all(athletes.map(function(a: any) { return fetchMLBSeasonAvg(a.id, a.shortName||a.displayName, a.position?.abbreviation||''); }));
      playerStats = results.filter(Boolean).slice(0, 10);
    }
    return { teamName, players: playerStats, isSeasonAvg: true };
  }
  const homeTeamName = homeRoster.team?.shortDisplayName || homeRoster.team?.displayName || '';
  const awayTeamName = awayRoster.team?.shortDisplayName || awayRoster.team?.displayName || '';
  const [homeStats, awayStats] = await Promise.all([
    getRosterStats(homeRoster, homeTeamName),
    getRosterStats(awayRoster, awayTeamName),
  ]);
  return [awayStats, homeStats];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId');
  const sport = searchParams.get('sport');
  if (!espnId || !sport) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  const mapped = SPORT_MAP[sport];
  if (!mapped) return NextResponse.json({ teams: [] });
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/' + mapped.sport + '/' + mapped.league + '/summary?event=' + espnId;
    const res = await fetch(url, { next: { revalidate: 30 } });
    const data = await res.json();
    const players = data?.boxscore?.players;
    const gameState = data?.header?.competitions?.[0]?.status?.type?.state;
    const isPreGame = gameState === 'pre';
    if (isPreGame) {
      const competitors = data?.header?.competitions?.[0]?.competitors || [];
      const home = competitors.find(function(c: any) { return c.homeAway === 'home'; });
      const away = competitors.find(function(c: any) { return c.homeAway === 'away'; });
      if (!home || !away) return NextResponse.json({ teams: [], isSeasonAvg: true });
      const teams = await fetchPreGameStats(mapped.sport, mapped.league, home.team.id, away.team.id, sport, home.team.abbreviation, away.team.abbreviation);
      return NextResponse.json({ teams, isSeasonAvg: true });
    }
    let teams: any[] = [];
    if (sport === 'basketball_nba' || sport === 'basketball_ncaab') teams = parseBoxscoreNBA(players);
    else if (sport === 'baseball_mlb') teams = parseBoxscoreMLB(players);
    else if (sport === 'icehockey_nhl') teams = parseBoxscoreNHL(players);
    else if (sport === 'americanfootball_nfl' || sport === 'americanfootball_ncaaf') teams = parseBoxscoreNFL(players);
    return NextResponse.json({ teams, isSeasonAvg: false });
  } catch {
    return NextResponse.json({ teams: [] });
  }
}
