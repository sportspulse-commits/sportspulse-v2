'use client';

export type BetType = 'moneyline' | 'spread' | 'total' | 'prop';
export type BetStatus = 'open' | 'won' | 'lost' | 'push';
export type BetLeague = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAAF' | 'NCAAB' | 'MMA' | 'F1';

export interface Bet {
  id: string;
  createdAt: string;
  league: BetLeague;
  game: string;
  betType: BetType;
  selection: string;
  odds: number;
  stake: number;
  sportsbook: string;
  status: BetStatus;
  payout?: number;
  notes?: string;
  gameId?: string;
}

export interface Archive {
  id: string;
  title: string;
  createdAt: string;
  bets: Bet[];
}

export interface PortfolioStats {
  totalBets: number;
  openBets: number;
  wonBets: number;
  lostBets: number;
  pushBets: number;
  totalStaked: number;
  totalPayout: number;
  pnl: number;
  roi: number;
  winRate: number;
  avgOdds: number;
}

const KEY = 'sportspulse_bets_v1';
const ARCHIVE_KEY = 'sportspulse_archives_v1';

export function getBets(): Bet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBet(bet: Omit<Bet, 'id' | 'createdAt'>): Bet {
  const newBet: Bet = {
    ...bet,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([newBet, ...getBets()]));
  return newBet;
}

export function updateBet(id: string, updates: Partial<Bet>): void {
  const bets = getBets().map(function(b) {
    return b.id === id ? Object.assign({}, b, updates) : b;
  });
  localStorage.setItem(KEY, JSON.stringify(bets));
}

export function deleteBet(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getBets().filter(function(b) { return b.id !== id; })));
}

export function getArchives(): Archive[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function archiveAndReset(title: string): void {
  const bets = getBets();
  if (bets.length === 0) return;
  const archive: Archive = {
    id: Date.now().toString(36),
    title,
    createdAt: new Date().toISOString(),
    bets,
  };
  const archives = getArchives();
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([archive, ...archives]));
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function calcPayout(stake: number, odds: number): number {
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

export function getPortfolioStats(bets: Bet[]): PortfolioStats {
  const settled = bets.filter(function(b) { return b.status !== 'open'; });
  const won = bets.filter(function(b) { return b.status === 'won'; });
  const lost = bets.filter(function(b) { return b.status === 'lost'; });
  const open = bets.filter(function(b) { return b.status === 'open'; });
  const totalStaked = bets.reduce(function(sum, b) { return sum + b.stake; }, 0);
  const totalPayout = won.reduce(function(sum, b) { return sum + (b.payout || 0); }, 0);
  const totalLost = lost.reduce(function(sum, b) { return sum + b.stake; }, 0);
  const pnl = totalPayout - totalLost;
  const settledStaked = settled.reduce(function(sum, b) { return sum + b.stake; }, 0);
  const roi = settledStaked > 0 ? (pnl / settledStaked) * 100 : 0;
  const winRate = settled.length > 0 ? (won.length / settled.length) * 100 : 0;
  const avgOdds = bets.length > 0 ? bets.reduce(function(sum, b) { return sum + b.odds; }, 0) / bets.length : 0;
  return {
    totalBets: bets.length,
    openBets: open.length,
    wonBets: won.length,
    lostBets: lost.length,
    pushBets: bets.filter(function(b) { return b.status === 'push'; }).length,
    totalStaked,
    totalPayout,
    pnl,
    roi,
    winRate,
    avgOdds,
  };
}

export function calcEV(modelProb: number, odds: number): number {
  const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  return ((modelProb * (decimal - 1)) - (1 - modelProb)) * 100;
}
