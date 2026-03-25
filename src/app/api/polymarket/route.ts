import { NextResponse } from 'next/server';

// Polymarket Gamma API - no auth required for read-only
const GAMMA_URL = 'https://gamma-api.polymarket.com';
const CLOB_URL = 'https://clob.polymarket.com';

// Normalize team name for fuzzy matching
function normTeam(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Convert Polymarket decimal price to percentage
function toPercent(price: number): number {
  return Math.round(price * 100);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('homeTeam') || '';
  const awayTeam = searchParams.get('awayTeam') || '';
  const sport = searchParams.get('sport') || 'basketball_nba';

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ markets: [] });
  }

  try {
    // Map sport to Polymarket search terms
    const sportTag = sport.includes('nba') ? 'NBA' :
      sport.includes('nfl') ? 'NFL' :
      sport.includes('mlb') ? 'MLB' :
      sport.includes('nhl') ? 'NHL' :
      sport.includes('ncaab') ? 'NCAAB' : 'NBA';

    // Search for markets matching the teams
    const homeLast = homeTeam.split(' ').pop() || homeTeam;
    const awayLast = awayTeam.split(' ').pop() || awayTeam;

    // Search Polymarket for game markets
    const searchRes = await fetch(
      GAMMA_URL + '/markets?q=' + encodeURIComponent(homeLast) + '&active=true&closed=false&limit=20',
      { next: { revalidate: 60 } }
    );
    const searchData = await searchRes.json();
    const markets = Array.isArray(searchData) ? searchData : [];

    // Find market that mentions both teams
    const homeNorm = normTeam(homeLast);
    const awayNorm = normTeam(awayLast);

    const match = markets.find(function(m: any) {
      const q = normTeam(m.question || '');
      const desc = normTeam(m.description || '');
      const combined = q + desc;
      return combined.includes(homeNorm) || combined.includes(awayNorm);
    });

    if (!match) {
      // Try searching by away team
      const searchRes2 = await fetch(
        GAMMA_URL + '/markets?q=' + encodeURIComponent(awayLast) + '&active=true&closed=false&limit=20',
        { next: { revalidate: 60 } }
      );
      const searchData2 = await searchRes2.json();
      const markets2 = Array.isArray(searchData2) ? searchData2 : [];
      const match2 = markets2.find(function(m: any) {
        const q = normTeam(m.question || '');
        return q.includes(homeNorm) || q.includes(awayNorm);
      });
      if (!match2) return NextResponse.json({ markets: [] });

      // Get live price from CLOB
      const tokenId = match2.clob_token_ids?.[0];
      if (!tokenId) return NextResponse.json({ markets: [{ question: match2.question, homeProb: null, awayProb: null, url: 'https://polymarket.com/event/' + match2.slug }] });

      const priceRes = await fetch(CLOB_URL + '/midpoint?token_id=' + tokenId, { next: { revalidate: 30 } });
      const priceData = await priceRes.json();
      const prob = priceData?.mid ? toPercent(parseFloat(priceData.mid)) : null;

      return NextResponse.json({
        markets: [{
          question: match2.question,
          slug: match2.slug,
          homeProb: prob,
          awayProb: prob ? 100 - prob : null,
          lastPrice: match2.lastTradePrice,
          volume: match2.volume,
          url: 'https://polymarket.com/event/' + match2.slug,
        }]
      });
    }

    // Get live price from CLOB for matched market
    const tokenId = match.clob_token_ids?.[0];
    if (!tokenId) {
      return NextResponse.json({
        markets: [{
          question: match.question,
          slug: match.slug,
          homeProb: match.lastTradePrice ? toPercent(parseFloat(match.lastTradePrice)) : null,
          awayProb: match.lastTradePrice ? 100 - toPercent(parseFloat(match.lastTradePrice)) : null,
          url: 'https://polymarket.com/event/' + match.slug,
        }]
      });
    }

    const priceRes = await fetch(CLOB_URL + '/midpoint?token_id=' + tokenId, { next: { revalidate: 30 } });
    const priceData = await priceRes.json();
    const prob = priceData?.mid ? toPercent(parseFloat(priceData.mid)) : null;

    return NextResponse.json({
      markets: [{
        question: match.question,
        slug: match.slug,
        homeProb: prob,
        awayProb: prob ? 100 - prob : null,
        lastPrice: match.lastTradePrice,
        volume: match.volume,
        url: 'https://polymarket.com/event/' + match.slug,
      }]
    });

  } catch (error) {
    console.error('Polymarket API error:', error);
    return NextResponse.json({ markets: [], error: String(error) });
  }
}