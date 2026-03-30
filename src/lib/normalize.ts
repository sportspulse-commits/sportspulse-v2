export function normalizeBet(b: any) {
  const stake = Number(b.stake || 0);
  const payout = Number(b.payout || 0);
  const net_profit = b.net_profit !== undefined && b.net_profit !== null
    ? Number(b.net_profit)
    : b.status === 'won' ? payout - stake
    : b.status === 'lost' ? -stake
    : 0;
  const status = b.status === 'pending' ? 'open' : (b.status || 'open');
  const date = (b.settled_at || b.game_date || b.gameDate || b.createdAt || b.created_at || '').slice(0, 10);
  const game = b.game || ((b.away_team || b.awayTeam || '') + ' @ ' + (b.home_team || b.homeTeam || ''));
  const pick = b.bet_pick || b.selection || b.pick || '';
  const league = (b.league || '').toUpperCase();
  const betType = b.bet_type || b.betType || '';
  return { ...b, net_profit, status, date, game, pick, league, betType, stake, payout };
}