import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: bets, error } = await client.from("bets").select("*").eq("user_id", user.id).order("settled_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const allBets = bets || [];
  const settled = allBets.filter(function(b) { return b.status === "won" || b.status === "lost" || b.status === "push"; });
  const won = settled.filter(function(b) { return b.status === "won"; });
  const lost = settled.filter(function(b) { return b.status === "lost"; });
  const push = settled.filter(function(b) { return b.status === "push"; });
  const pending = allBets.filter(function(b) { return b.status === "open" || b.status === "pending"; });
  const settledNoPush = settled.filter(function(b) { return b.status !== "push"; });
  const totalStaked = settled.reduce(function(s, b) { return s + Number(b.stake || 0); }, 0);
  const pnl = settled.reduce(function(s, b) { return s + Number(b.net_profit || 0); }, 0);
  const roi = totalStaked > 0 ? (pnl / totalStaked) * 100 : 0;
  const winRate = settledNoPush.length > 0 ? (won.length / settledNoPush.length) * 100 : 0;
  let running = 0;
  const pnlOverTime = settled.map(function(b, idx) {
    const gain = Number(b.net_profit || 0);
    running += gain;
    return { idx: idx + 1, date: (b.settled_at || b.created_at || "").slice(0, 10), pnl: Math.round(running * 100) / 100, gain: Math.round(gain * 100) / 100, game: (b.away_team || "") + " @ " + (b.home_team || ""), pick: b.bet_pick || "", odds: b.odds || 0, stake: Number(b.stake || 0), result: b.status };
  });
  const leagueSet = [...new Set(settled.map(function(b) { return (b.league || "").toUpperCase(); }))].filter(Boolean);
  const byLeague = leagueSet.map(function(league) {
    const lb = settled.filter(function(b) { return (b.league || "").toUpperCase() === league; });
    const lnp = lb.filter(function(b) { return b.status !== "push"; });
    const lw = lb.filter(function(b) { return b.status === "won"; });
    return { league, total: lb.length, wins: lw.length, winRate: lnp.length > 0 ? Math.round((lw.length / lnp.length) * 100) : 0 };
  }).filter(function(l) { return l.total > 0; }).sort(function(a, b) { return b.total - a.total; });
  const typeSet = [...new Set(settled.map(function(b) { return b.bet_type || ""; }))].filter(Boolean);
  const byBetType = typeSet.map(function(type) {
    const tb = settled.filter(function(b) { return (b.bet_type || "") === type; });
    const tnp = tb.filter(function(b) { return b.status !== "push"; });
    const tw = tb.filter(function(b) { return b.status === "won"; });
    return { type, total: tb.length, wins: tw.length, winRate: tnp.length > 0 ? Math.round((tw.length / tnp.length) * 100) : 0 };
  }).filter(function(t) { return t.total > 0; });
  let streak = 0; let streakType = "";
  for (const b of [...settled].reverse()) {
    if (b.status === "push") continue;
    if (streak === 0) { streakType = b.status; streak = 1; }
    else if (b.status === streakType) { streak++; }
    else { break; }
  }
  const recentBets = [...settled].reverse().slice(0, 50).map(function(b) {
    return { id: b.id, date: (b.settled_at || b.created_at || "").slice(0, 10), game: (b.away_team || "") + " @ " + (b.home_team || ""), pick: b.bet_pick || "", odds: b.odds || 0, stake: Number(b.stake || 0), status: b.status, pnl: Math.round(Number(b.net_profit || 0) * 100) / 100, league: (b.league || "").toUpperCase(), betType: b.bet_type || "" };
  });
  return NextResponse.json({ summary: { totalBets: allBets.length, settledBets: settled.length, pendingBets: pending.length, wonBets: won.length, lostBets: lost.length, pushBets: push.length, totalStaked: Math.round(totalStaked * 100) / 100, pnl: Math.round(pnl * 100) / 100, roi: Math.round(roi * 10) / 10, winRate: Math.round(winRate * 10) / 10, streak, streakType }, pnlOverTime, byLeague, byBetType, recentBets });
}
