import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ bets: [] });
  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ bets: [] });
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('BETS API ERROR:', JSON.stringify(error)); return NextResponse.json({ error: error.message, details: error }, { status: 500 }); }
  return NextResponse.json({ bets: data || [] });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { data, error } = await supabase
    .from('bets')
    .insert([{
      user_id: user.id,
      sport: body.sport || body.league || 'NBA',
      league: body.league || body.sport || 'NBA',
      home_team: body.homeTeam || body.game?.split(' @ ')?.[1] || body.game || '',
      away_team: body.awayTeam || body.game?.split(' @ ')?.[0] || '',
      game_date: body.gameDate || new Date().toISOString().slice(0, 10),
      game_id: body.gameId || null,
      bet_type: body.betType || 'moneyline',
      bet_pick: body.selection || body.bet_pick || '',
      sportsbook: body.sportsbook || 'DraftKings',
      odds: body.odds || 0,
      stake: body.stake || 0,
      status: 'pending',
      notes: body.notes || null,
    }])
    .select()
    .single();
  if (error) { console.error('BETS API ERROR:', JSON.stringify(error)); return NextResponse.json({ error: error.message, details: error }, { status: 500 }); }
  return NextResponse.json({ bet: data });
}

export async function PATCH(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing bet id' }, { status: 400 });
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status === 'won' ? 'won' : updates.status === 'lost' ? 'lost' : updates.status === 'push' ? 'push' : 'pending';
  if (updates.payout !== undefined) dbUpdates.payout = updates.payout;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  dbUpdates.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('bets')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) { console.error('BETS API ERROR:', JSON.stringify(error)); return NextResponse.json({ error: error.message, details: error }, { status: 500 }); }
  return NextResponse.json({ bet: data });
}

export async function DELETE(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabase
    .from('bets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) { console.error('BETS API ERROR:', JSON.stringify(error)); return NextResponse.json({ error: error.message, details: error }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
