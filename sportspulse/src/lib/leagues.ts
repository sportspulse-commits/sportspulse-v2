export const LEAGUE_COLORS: Record<string, string> = {
  NFL: '#fbbf24',
  NBA: '#60a5fa',
  MLB: '#f87171',
  NHL: '#c084fc',
  NCAAF: '#fb923c',
  NCAAB: '#34d399',
  MMA: '#f43f5e',
  F1: '#e11d48',
};

export const SPORT_KEYS: Record<string, string> = {
  NFL: 'americanfootball_nfl',
  NBA: 'basketball_nba',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
  NCAAF: 'americanfootball_ncaaf',
  NCAAB: 'basketball_ncaab',
  MMA: 'mma_mixed_martial_arts',
  F1: 'f1',
};

export function normalizeLeague(raw: string): string {
  const s = raw.toUpperCase();
  if (s.includes('NCAAF') || s === 'AMERICANFOOTBALL_NCAAF') return 'NCAAF';
  if (s.includes('NCAAB') || s === 'BASKETBALL_NCAAB') return 'NCAAB';
  if (s.includes('MMA') || s.includes('MARTIAL')) return 'MMA';
  if (s.includes('F1') || s.includes('FORMULA')) return 'F1';
  if (s.includes('BASKET') || s === 'NBA') return 'NBA';
  if (s.includes('BASEBALL') || s === 'MLB') return 'MLB';
  if (s.includes('HOCKEY') || s === 'NHL') return 'NHL';
  if (s.includes('FOOTBALL') || s === 'NFL') return 'NFL';
  return s;
}

export function leagueColor(raw: string): string {
  return LEAGUE_COLORS[normalizeLeague(raw)] ?? '#94a3b8';
}
