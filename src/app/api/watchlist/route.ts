import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: 'Bearer ' + token } } }
  );
}

export async function GET(request: Request) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ items: [] });
  const supabase = getSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.from('watchlist').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { data, error } = await supabase.from('watchlist').insert([{
    user_id: user.id,
    game_id: body.game_id,
    sport: body.sport,
    home_team: body.home_team,
    away_team: body.away_team,
    game_date: body.game_date || new Date().toISOString().slice(0, 10),
  }]).select().single();
  if (error) { console.error('Watchlist insert error:', JSON.stringify(error)); return NextResponse.json({ error: error.message }, { status: 400 }); }
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('game_id');
  if (!gameId) return NextResponse.json({ error: 'Missing game_id' }, { status: 400 });
  await supabase.from('watchlist').delete().eq('user_id', user.id).eq('game_id', gameId);
  return NextResponse.json({ success: true });
}