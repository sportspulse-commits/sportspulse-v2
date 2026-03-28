import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: 'Bearer ' + token } } }
  );
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: bets, error } = await client
    .from('bets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const allBets = bets || [];
  const settled = allBets.filter(function(b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
  const won = allBets.filter(function(b) { return b.status === 'won'; });
  const lost = allBets.filter(function(b) { return b.status === 'lost'; });
  const pending = allBets.filter(function(b) { return b.status === 'pending'; });
  const totalStaked = settled.reduce(function(s, b) { return s + Number(b.stake); }, 0);
  const totalPayout = won.reduce(function(s, b) { return s + Number(b.payout || 0); }, 0);
  const totalLost = lost.reduce(function(s, b) { return s + Number(b.stake); }, 0);
  const pnl = totalPayout - totalLost;
  const roi = totalStaked > 0 ? (pnl / totalStaked) * 100 : 0;
  const push = allBets.filter(function(b) { return b.status === 'push'; });
  const settledNoPush = settled.filter(function(b) { return b.status !== 'push'; });
  const winRate = settledNoPush.length > 0 ? (won.length / settledNoPush.length) * 100 : 0;
  let running = 0;
  const pnlOverTime = settled.map(function(b) {
    const gain = b.status === 'won' ? Number(b.payout || 0) : b.status === 'lost' ? -Number(b.stake) : 0;
    running += gain;
    return { date: b.created_at.slice(0, 10), pnl: Math.round(running * 100) / 100, game: (b.away_team || '') + ' @ ' + (b.home_team || '') };
  });
  const leagues = [...new Set(allBets.map(function(b) { return b.league; }))];
  const byLeague = leagues.map(function(league) {
    const lb = settled.filter(function(b) { return b.league === league; });
    const lw = lb.filter(function(b) { return b.status === 'won'; });
    return { league, total: lb.length, wins: lw.length, winRate: lb.length > 0 ? Math.round((lw.length / lb.length) * 100) : 0 };
  }).filter(function(l) { return l.total > 0; }).sort(function(a, b) { return b.total - a.total; });
  const betTypes = [...new Set(allBets.map(function(b) { return b.bet_type; }))];
  const byBetType = betTypes.map(function(type) {
    const tb = settled.filter(function(b) { return b.bet_type === type; });
    const tw = tb.filter(function(b) { return b.status === 'won'; });
    return { type, total: tb.length, wins: tw.length, winRate: tb.length > 0 ? Math.round((tw.length / tb.length) * 100) : 0 };
  }).filter(function(t) { return t.total > 0; });
  let streak = 0;
  let streakType = '';
  const reversedSettled = [...settled].reverse();
  for (const b of reversedSettled) {
    if (b.status === 'push') continue;
    if (streak === 0) { streakType = b.status; streak = 1; }
    else if (b.status === streakType) { streak++; }
    else { break; }
  }
  const recentBets = settled.slice(-10).reverse().map(function(b) {
    const pnlVal = b.status === 'won' ? Number(b.payout || 0) : b.status === 'lost' ? -Number(b.stake) : 0;
    return {
      id: b.id, date: b.created_at.slice(0, 10),
      game: (b.away_team || '') + ' @ ' + (b.home_team || ''),
      pick: b.bet_pick, odds: b.odds, stake: Number(b.stake),
      status: b.status, pnl: Math.round(pnlVal * 100) / 100,
      league: b.league, betType: b.bet_type,
    };
  });
  return NextResponse.json({
    summary: {
      totalBets: allBets.length, settledBets: settled.length,
      pendingBets: pending.length, wonBets: won.length, lostBets: lost.length, pushBets: push.length,
      totalStaked: Math.round(totalStaked * 100) / 100,
      totalPayout: Math.round(totalPayout * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      roi: Math.round(roi * 10) / 10,
      winRate: Math.round(winRate * 10) / 10,
      streak, streakType,
    },
    pnlOverTime, byLeague, byBetType, recentBets,
  });
}