import { NextResponse } from 'next/server';

const ESPN_SPORT_MAP: Record<string, { sport: string; league: string; groups?: string }> = {
  americanfootball_nfl: { sport: 'football', league: 'nfl' },
  basketball_nba: { sport: 'basketball', league: 'nba' },
  baseball_mlb: { sport: 'baseball', league: 'mlb' },
  icehockey_nhl: { sport: 'hockey', league: 'nhl' },
  basketball_ncaab: { sport: 'basketball', league: 'mens-college-basketball', groups: '100' },
  americanfootball_ncaaf: { sport: 'football', league: 'college-football' },
  mma_mixed_martial_arts: { sport: 'mma', league: 'ufc' },
};

const SCORING_VARIANCE: Record<string, number> = {
  basketball_nba: 2.5, basketball_ncaab: 3.0,
  americanfootball_nfl: 1.2, americanfootball_ncaaf: 1.2,
  icehockey_nhl: 8.0, baseball_mlb: 6.0, mma_mixed_martial_arts: 5.0,
};

function normLast(s: string): string {
  return (s || '').split(' ').filter(Boolean).pop()?.toLowerCase() || '';
}

function oddsToProb(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function impliedProb(homeML: number, awayML: number): { homeProb: number; awayProb: number } {
  const rawHome = oddsToProb(homeML);
  const rawAway = oddsToProb(awayML);
  const total = rawHome + rawAway;
  return {
    homeProb: Math.round((rawHome / total) * 100),
    awayProb: Math.round((rawAway / total) * 100),
  };
}

function getProgress(clock: string, period: number, sport: string): number {
  try {
    const parts = clock.split(':');
    const secsRemaining = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    if (sport.includes('ncaab')) {
      const elapsed = (period - 1) * 1200 + (1200 - secsRemaining);
      return Math.min(1, elapsed / 2400);
    }
    if (sport.includes('basketball')) {
      const elapsed = (period - 1) * 720 + (720 - secsRemaining);
      return Math.min(1, elapsed / 2880);
    }
    if (sport.includes('football')) {
      const elapsed = (period - 1) * 900 + (900 - secsRemaining);
      return Math.min(1, elapsed / 3600);
    }
    if (sport.includes('hockey')) {
      const elapsed = (period - 1) * 1200 + (1200 - secsRemaining);
      return Math.min(1, elapsed / 3600);
    }
  } catch {}
  const periodsMap: Record<string, number> = {
    basketball_ncaab: 2, basketball_nba: 4,
    americanfootball_nfl: 4, americanfootball_ncaaf: 4, icehockey_nhl: 3,
  };
  return Math.min(0.95, (period - 0.5) / (periodsMap[sport] || 2));
}

function scoreBasedProb(diff: number, progressPct: number, sport: string): number {
  const avgTotalPts: Record<string, number> = {
    basketball_nba: 230, basketball_ncaab: 140,
    americanfootball_nfl: 45, americanfootball_ncaaf: 55,
    icehockey_nhl: 6, baseball_mlb: 9, mma_mixed_martial_arts: 10,
  };
  const totalPts = avgTotalPts[sport] || 140;
  const remainingPts = totalPts * (1 - progressPct);
  const varianceFactor = SCORING_VARIANCE[sport] || 3.0;
  const sigma = Math.sqrt(remainingPts) * varianceFactor / 10;
  if (sigma < 0.01) return diff > 0 ? 97 : diff < 0 ? 3 : 50;
  const z = diff / sigma;
  const dampening = 0.2 + (progressPct * 0.8);
  const raw = 50 + 50 * Math.tanh(z * 0.7) * dampening;
  return Math.max(3, Math.min(97, raw));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';
  const sport = searchParams.get('sport') || '';
  const homeOdds = parseFloat(searchParams.get('homeOdds') || '');
  const awayOdds = parseFloat(searchParams.get('awayOdds') || '');

  const cfg = ESPN_SPORT_MAP[sport];
  const homeLast = normLast(homeTeam);
  const awayLast = normLast(awayTeam);

  if (cfg && homeLast && awayLast) {
    try {
      const groupParam = cfg.groups ? '?groups=' + cfg.groups : '';
      const sbUrl = 'https://site.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/scoreboard' + groupParam;
      const sbRes = await fetch(sbUrl, { cache: 'no-store' });
      const sbData = await sbRes.json();
      const events = sbData?.events || [];

      // Find matching event
      let matchedEvent: any = null;
      for (const event of events) {
        const comp = event.competitions?.[0];
        const competitors = comp?.competitors || [];
        const names = competitors.map(function(c: any) {
          return normLast(c.team?.displayName || c.team?.name || '');
        });
        if (names.includes(homeLast) && names.includes(awayLast)) {
          matchedEvent = event;
          break;
        }
      }

      if (matchedEvent) {
        const comp = matchedEvent.competitions?.[0];
        const competitors = comp?.competitors || [];
        const homeComp = competitors.find(function(c: any) { return c.homeAway === 'home'; });
        const awayComp = competitors.find(function(c: any) { return c.homeAway === 'away'; });
        const statusType = comp?.status?.type?.name || '';
        const isLive = statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME';
        const isScheduled = statusType === 'STATUS_SCHEDULED';

        if (isLive) {
          // Try ESPN summary win probability first
          try {
            const summaryUrl = 'https://site.web.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/summary?event=' + matchedEvent.id;
            const sumRes = await fetch(summaryUrl, { cache: 'no-store' });
            const sumData = await sumRes.json();
            const winProbs = sumData?.winprobability || [];
            if (winProbs.length > 0) {
              const latest = winProbs[winProbs.length - 1];
              const homeWinPct = Number(latest.homeWinPercentage ?? 0.5);
              return NextResponse.json({
                homeProb: Math.round(homeWinPct * 100),
                awayProb: Math.round((1 - homeWinPct) * 100),
                source: 'ESPN',
              });
            }
          } catch {}

          // Score-based fallback for live games
          const homeScore = Number(homeComp?.score || 0);
          const awayScore = Number(awayComp?.score || 0);
          const diff = homeScore - awayScore;
          const clock = comp?.status?.displayClock || '0:00';
          const period = comp?.status?.period || 1;
          const progress = getProgress(clock, period, sport);
          const homeProb = scoreBasedProb(diff, progress, sport);
          return NextResponse.json({
            homeProb: Math.round(homeProb),
            awayProb: Math.round(100 - homeProb),
            source: 'Live Model',
          });
        }

        if (isScheduled) {
          // Try ESPN pickcenter for pre-game implied probability
          try {
            const summaryUrl = 'https://site.web.api.espn.com/apis/site/v2/sports/' + cfg.sport + '/' + cfg.league + '/summary?event=' + matchedEvent.id;
            const sumRes = await fetch(summaryUrl, { next: { revalidate: 300 } });
            const sumData = await sumRes.json();
            const pickcenter = sumData?.pickcenter || [];
            if (pickcenter.length > 0) {
              const pc = pickcenter[0];
              const homeML = pc.homeTeamOdds?.moneyLine;
              const awayML = pc.awayTeamOdds?.moneyLine;
              if (homeML && awayML) {
                const probs = impliedProb(homeML, awayML);
                return NextResponse.json({ ...probs, source: 'ESPN' });
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  // Fallback: passed moneyline odds
  if (!isNaN(homeOdds) && !isNaN(awayOdds)) {
    const probs = impliedProb(homeOdds, awayOdds);
    return NextResponse.json({ ...probs, source: 'Implied (ML)' });
  }

  return NextResponse.json({ homeProb: 50, awayProb: 50, source: 'No data' });
}
