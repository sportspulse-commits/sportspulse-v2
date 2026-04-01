'use client';

import { normalizeBet } from '@/lib/normalize';
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
  pnl: number;
  roi: number;
  winRate: number;
  avgOdds: number;
  settledBets: number;
  streak: number;
  streakType: string;
}

const KEY = 'sportspulse_bets_v1';
const ARCHIVE_KEY = 'sportspulse_archives_v2';

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


export function calcPayout(stake: number, odds: number): number {
  if (odds > 0) return stake + stake * (odds / 100);
  return stake + stake * (100 / Math.abs(odds));
}


export function calcProfit(stake: number, odds: number): number {
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}
export function getPortfolioStats(bets: Bet[], openBetsOverride?: number): PortfolioStats {
  const normalized = bets.map(normalizeBet);
  const settled = normalized.filter(function(b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
  const won = settled.filter(function(b) { return b.status === 'won'; });
  const lost = settled.filter(function(b) { return b.status === 'lost'; });
  const open = normalized.filter(function(b) { return b.status === 'open'; });
  const totalStaked = settled.reduce(function(sum, b) { return sum + b.stake; }, 0);
  const pnl = Math.round(settled.reduce(function(sum, b) { return sum + b.net_profit; }, 0) * 100) / 100;
  const roi = totalStaked > 0 ? Math.round((pnl / totalStaked) * 1000) / 10 : 0;
  const noPush = settled.filter(function(b) { return b.status !== 'push'; });
  const winRate = noPush.length > 0 ? Math.round((won.length / noPush.length) * 1000) / 10 : 0;
  const avgOdds = normalized.length > 0 ? Math.round(normalized.reduce(function(sum, b) { return sum + b.odds; }, 0) / normalized.length * 10) / 10 : 0;
  let streak = 0; let streakType = '';
  for (const b of [...settled].reverse()) {
    if (b.status === 'push') continue;
    if (streak === 0) { streakType = b.status; streak = 1; }
    else if (b.status === streakType) { streak++; }
    else { break; }
  }
  return {
    totalBets: normalized.length,
    openBets: openBetsOverride !== undefined ? openBetsOverride : open.length,
    wonBets: won.length,
    lostBets: lost.length,
    pushBets: settled.filter(function(b) { return b.status === 'push'; }).length,
    totalStaked,
    pnl,
    roi,
    winRate,
    avgOdds,
    settledBets: settled.length,
    streak,
    streakType,
  };
}

export function calcEV(modelProb: number, odds: number): number {
  const decimal = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  return ((modelProb * (decimal - 1)) - (1 - modelProb)) * 100;
}
