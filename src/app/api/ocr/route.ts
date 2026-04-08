import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Compress image by resizing to max 800px using canvas-like approach
// We do this server-side by accepting already-compressed base64 from client
// Client compresses before sending (see AddBetForm)

const OCR_PROMPT = `You are a sports betting slip parser. Extract ALL available information from this bet slip image.

Return ONLY a valid JSON object with these exact fields (omit fields that are genuinely not visible):

{
  "betType": "moneyline" | "spread" | "total" | "prop" | "parlay" | "futures",
  "selection": "exact pick text as shown on slip",
  "odds": <American odds as integer, e.g. -110 or 150. Convert decimal (1.91) or fractional (10/11) to American>,
  "stake": <wager/risk amount as number, no $ sign>,
  "payout": <total return amount if shown, as number. This is stake + profit, not just profit>,
  "sportsbook": "name of sportsbook exactly as shown",
  "homeTeam": "home team name if identifiable",
  "awayTeam": "away team name if identifiable",  
  "rawDate": "date as shown on slip in any format, e.g. '3/31/2026' or 'Mar 31' or '2026-03-31'",
  "isSettled": true if the slip shows a final result (WON/LOST/PUSH/WIN/LOSS/SETTLED/GRADED),
  "result": "won" | "lost" | "push" | null (only if isSettled is true),
  "league": "NBA" | "NFL" | "MLB" | "NHL" | "NCAAB" | "NCAAF" | "MMA" | "F1" | null,
  "legs": [
    {
      "selection": "leg pick text",
      "odds": <leg odds as American integer>,
      "betType": "moneyline" | "spread" | "total" | "prop",
      "homeTeam": "home team",
      "awayTeam": "away team",
      "result": "won" | "lost" | "push" | null
    }
  ] (only for parlays, otherwise omit)
}

IMPORTANT RULES:
- odds must be American format integer. If decimal odds (e.g. 1.91), convert: if >= 2.0 then (odds-1)*100, if < 2.0 then -100/(odds-1). Round to nearest integer.
- stake is the amount wagered/risked, NOT the potential payout
- payout is total return (stake + profit), NOT just profit
- isSettled must be true ONLY if there is a clear WIN/LOSS/PUSH indicator on the slip
- result must match isSettled: if isSettled is false, result must be null
- Return ONLY the JSON object. No markdown, no explanation, no trailing text.`;

export async function POST(request: Request) {
  try {
    const { base64, mediaType } = await request.json();
    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    // Validate media type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { 
            type: 'image', 
            source: { type: 'base64', media_type: mediaType as any, data: base64 } 
          },
          { type: 'text', text: OCR_PROMPT }
        ]
      }]
    });

    const text = response.content
      .filter(function(c: any) { return c.type === 'text'; })
      .map(function(c: any) { return c.text; })
      .join('');

    // Strip any markdown code fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    
    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('OCR JSON parse failed. Raw response:', text);
      return NextResponse.json({ error: 'Could not parse bet slip. Please fill in manually.' }, { status: 422 });
    }

    // Normalize and validate the parsed result
    const result: any = {};

    // betType - normalize to our supported types
    const betTypeMap: Record<string, string> = {
      moneyline: 'moneyline', ml: 'moneyline', 'money line': 'moneyline',
      spread: 'spread', ats: 'spread', 'point spread': 'spread',
      total: 'total', 'over/under': 'total', ou: 'total',
      prop: 'prop', proposition: 'prop',
      parlay: 'parlay', 'same game parlay': 'parlay', sgp: 'parlay',
      futures: 'futures', future: 'futures',
    };
    if (parsed.betType) {
      result.betType = betTypeMap[parsed.betType.toLowerCase()] || parsed.betType.toLowerCase();
    }

    // odds - ensure American format integer
    if (parsed.odds !== undefined && parsed.odds !== null) {
      const o = Number(parsed.odds);
      if (!isNaN(o)) {
        // Already American if abs >= 100
        if (Math.abs(o) >= 100) {
          result.odds = Math.round(o);
        } else if (o > 1) {
          // Decimal odds
          result.odds = o >= 2 ? Math.round((o - 1) * 100) : Math.round(-100 / (o - 1));
        }
      }
    }

    // stake
    if (parsed.stake !== undefined && parsed.stake !== null) {
      const s = Number(String(parsed.stake).replace(/[^0-9.]/g, ''));
      if (!isNaN(s) && s > 0) result.stake = s;
    }

    // payout - total return
    if (parsed.payout !== undefined && parsed.payout !== null) {
      const p = Number(String(parsed.payout).replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && p > 0) result.payout = p;
    }

    // If we have stake and payout but no odds, derive odds
    if (result.stake && result.payout && !result.odds) {
      const profit = result.payout - result.stake;
      if (profit > 0) {
        const decimal = result.payout / result.stake;
        result.odds = decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
      }
    }

    // text fields
    if (parsed.selection) result.selection = String(parsed.selection).trim();
    if (parsed.sportsbook) result.sportsbook = String(parsed.sportsbook).trim();
    if (parsed.homeTeam) result.homeTeam = String(parsed.homeTeam).trim();
    if (parsed.awayTeam) result.awayTeam = String(parsed.awayTeam).trim();
    if (parsed.rawDate) result.rawDate = String(parsed.rawDate).trim();
    if (parsed.league) result.league = String(parsed.league).toUpperCase().trim();

    // result/settlement
    result.isSettled = parsed.isSettled === true;
    if (result.isSettled && parsed.result) {
      const r = String(parsed.result).toLowerCase();
      if (['won', 'win', 'winner'].includes(r)) result.result = 'won';
      else if (['lost', 'loss', 'loser'].includes(r)) result.result = 'lost';
      else if (['push', 'tie', 'draw'].includes(r)) result.result = 'push';
    } else {
      result.result = null;
    }

    // parlay legs
    if (parsed.legs && Array.isArray(parsed.legs) && parsed.legs.length > 0) {
      result.legs = parsed.legs.map(function(leg: any) {
        const l: any = {};
        if (leg.selection) l.selection = String(leg.selection).trim();
        if (leg.betType) l.betType = betTypeMap[leg.betType.toLowerCase()] || leg.betType.toLowerCase();
        if (leg.odds !== undefined) {
          const lo = Number(leg.odds);
          if (!isNaN(lo) && Math.abs(lo) >= 100) l.odds = Math.round(lo);
        }
        if (leg.homeTeam) l.homeTeam = String(leg.homeTeam).trim();
        if (leg.awayTeam) l.awayTeam = String(leg.awayTeam).trim();
        if (leg.result) {
          const r = String(leg.result).toLowerCase();
          l.result = ['won','win'].includes(r) ? 'won' : ['lost','loss'].includes(r) ? 'lost' : ['push','tie'].includes(r) ? 'push' : null;
        }
        return l;
      }).filter(function(l: any) { return l.selection || l.homeTeam; });
    }

    return NextResponse.json({ result });
  } catch (e: any) {
    console.error('OCR route error:', e?.message || e);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}