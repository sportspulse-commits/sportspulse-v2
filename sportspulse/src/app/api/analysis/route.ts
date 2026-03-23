import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { game, odds, question } = body;

    const systemPrompt = 'You are a sports analytics expert and betting analyst. Be concise and analytical. Use specific numbers. Format for a trading terminal UI - clear, data-driven, no fluff.';
    const userMessage = question
      ? 'Game: ' + JSON.stringify(game) + '\n\nQuestion: ' + question
      : 'Analyze this game and identify any betting edges. Include key stats, injury considerations, and value picks: ' + JSON.stringify({ game, odds });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    return NextResponse.json({
      analysis: message.content[0].type === 'text' ? message.content[0].text : ''
    });
  } catch (error) {
    return NextResponse.json({ analysis: 'Analysis unavailable: ' + String(error) }, { status: 500 });
  }
}
