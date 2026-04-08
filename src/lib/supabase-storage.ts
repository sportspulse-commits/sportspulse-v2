import { Bet, calcPayout, calcProfit, getPortfolioStats } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';

function mapDbBet(b: any): Bet {
  return {
    id: b.id,
    createdAt: b.created_at,
    league: b.league as any,
    game: b.away_team + ' @ ' + b.home_team,
    betType: b.bet_type as any,
    selection: b.bet_pick,
    odds: b.odds,
    stake: Number(b.stake),
    sportsbook: b.sportsbook,
    status: b.status === 'pending' ? 'open' : b.status as any,
    payout: b.payout ? Number(b.payout) : undefined,
    notes: b.notes ?? undefined,
    gameId: b.game_id ?? undefined,
  };
}

export async function getSupabaseBets(): Promise<Bet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getSupabaseBets error:', error); return []; }
  return (data || []).map(mapDbBet);
}

export async function saveSupabaseBet(bet: any): Promise<Bet | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('bets')
    .insert([{
      user_id: session.user.id,
      sport: bet.sport || bet.league || 'NBA',
      league: bet.league || bet.sport || 'NBA',
      home_team: bet.homeTeam || '',
      away_team: bet.awayTeam || '',
      game_date: bet.gameDate || new Date().toISOString().slice(0, 10),
      game_id: bet.gameId || null,
      bet_type: bet.betType || 'moneyline',
      bet_pick: bet.selection || '',
      sportsbook: bet.sportsbook || 'DraftKings',
      odds: bet.odds || 0,
      stake: bet.stake || 0,
      status: bet.status === 'won' || bet.status === 'lost' || bet.status === 'push' ? bet.status : 'pending',
      payout: bet.payout !== undefined ? bet.payout : null,
      notes: bet.notes || null,
    }])
    .select()
    .single();
  if (error) { console.error('saveSupabaseBet error:', error); return null; }
  return mapDbBet(data);
}

export async function updateSupabaseBet(id: string, updates: any): Promise<void> {
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status === 'open' ? 'pending' : updates.status;
  if (updates.payout !== undefined) dbUpdates.payout = updates.payout;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  dbUpdates.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from('bets')
    .update(dbUpdates)
    .eq('id', id);
  if (error) console.error('updateSupabaseBet error:', error);
}

export async function deleteSupabaseBet(id: string): Promise<void> {
  const { error } = await supabase
    .from('bets')
    .delete()
    .eq('id', id);
  if (error) console.error('deleteSupabaseBet error:', error);
}

export { calcPayout, calcProfit, getPortfolioStats };
