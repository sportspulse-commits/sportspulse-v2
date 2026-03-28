'use client';

import React, { useState, useEffect } from 'react';
import { saveBet, calcPayout, BetLeague, BetType } from '@/lib/storage';
import { saveSupabaseBet } from '@/lib/supabase-storage';
import { supabase } from '@/lib/supabase/client';
import { normalizeLeague, SPORT_KEYS } from '@/lib/leagues';

interface AddBetFormProps {
  onBetAdded: () => void;
  defaultSportsbook?: string;
  allGames?: any[];
  allOdds?: Record<string, any>;
}

export default function AddBetForm({ onBetAdded, defaultSportsbook = 'DraftKings', allGames = [], allOdds = {} }: AddBetFormProps) {
  const [selectedGameId, setSelectedGameId] = useState('');
  const [betType, setBetType] = useState('moneyline');
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [stake, setStake] = useState('');
  const [sportsbook, setSportsbook] = useState(defaultSportsbook);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [oddsMap, setOddsMap] = useState<Record<string, any>>({});

  // Update sportsbook when default changes
  useEffect(function() { setSportsbook(defaultSportsbook); }, [defaultSportsbook]);

  const selectedGame = allGames.find(function(g) { return g.id === selectedGameId; });
  const oddsData = oddsMap[selectedGameId];

  // Use passed allOdds to get game odds - no fetch needed
  useEffect(function() {
    if (!selectedGame) return;
    const hk = (selectedGame.homeTeam || '').split(' ').pop()?.toLowerCase() || '';
    const ak = (selectedGame.awayTeam || '').split(' ').pop()?.toLowerCase() || '';
    const key = ak + '@' + hk;
    const odd = allOdds[key];
    if (!odd) return;
    const book = odd.bookmakers && (
      odd.bookmakers.find(function(b: any) { return b.title.toLowerCase() === sportsbook.toLowerCase(); }) ||
      odd.bookmakers[0]
    );
    if (!book) return;
    const h2h = book.markets?.find(function(m: any) { return m.key === 'h2h'; });
    const spreads = book.markets?.find(function(m: any) { return m.key === 'spreads'; });
    const totals = book.markets?.find(function(m: any) { return m.key === 'totals'; });
    setOddsMap(function(prev) {
      return Object.assign({}, prev, {
        [selectedGame.id]: { event: odd, h2h, spreads, totals, home: odd.home_team, away: odd.away_team }
      });
    });
  }, [selectedGame?.id, sportsbook, allOdds]);

  // Build selection options based on bet type
  function getSelections(): { label: string; odds: number; point?: number }[] {
    if (!oddsData) return [];
    function fmt(o: any, name: string): { label: string; odds: number; point?: number } | null {
      if (!o) return null;
      return { label: name, odds: o.price, point: o.point };
    }
    function byName(outcomes: any[], name: string) {
      return outcomes?.find(function(o: any) { return o.name === name; });
    }
    if (betType === 'moneyline' && oddsData.h2h) {
      return [
        fmt(byName(oddsData.h2h.outcomes, oddsData.away), oddsData.away + ' ML'),
        fmt(byName(oddsData.h2h.outcomes, oddsData.home), oddsData.home + ' ML'),
      ].filter(Boolean) as any[];
    }
    if (betType === 'spread' && oddsData.spreads) {
      return [
        fmt(byName(oddsData.spreads.outcomes, oddsData.away), oddsData.away + ' ' + (byName(oddsData.spreads.outcomes, oddsData.away)?.point > 0 ? '+' : '') + byName(oddsData.spreads.outcomes, oddsData.away)?.point),
        fmt(byName(oddsData.spreads.outcomes, oddsData.home), oddsData.home + ' ' + (byName(oddsData.spreads.outcomes, oddsData.home)?.point > 0 ? '+' : '') + byName(oddsData.spreads.outcomes, oddsData.home)?.point),
      ].filter(Boolean) as any[];
    }
    if (betType === 'total' && oddsData.totals) {
      return [
        fmt(oddsData.totals.outcomes?.find(function(o: any) { return o.name === 'Over'; }), 'Over ' + oddsData.totals.outcomes?.find(function(o: any) { return o.name === 'Over'; })?.point),
        fmt(oddsData.totals.outcomes?.find(function(o: any) { return o.name === 'Under'; }), 'Under ' + oddsData.totals.outcomes?.find(function(o: any) { return o.name === 'Under'; })?.point),
      ].filter(Boolean) as any[];
    }
    return [];
  }

  const selections = getSelections();

  function handleSelectionChange(label: string) {
    setSelection(label);
    const found = selections.find(function(s) { return s.label === label; });
    if (found) setOdds(String(found.odds > 0 ? '+' + found.odds : found.odds));
  }

  const oddsNum = parseFloat(odds);
  const stakeNum = parseFloat(stake);
  const potentialPayout = (!isNaN(oddsNum) && !isNaN(stakeNum) && stakeNum > 0) ? calcPayout(stakeNum, oddsNum) : 0;

  async function handleSubmit() {
    if (!selectedGame) { setError('Select a game'); return; }
    if (!selection.trim()) { setError('Select a bet'); return; }
    if (isNaN(oddsNum)) { setError('Enter valid odds'); return; }
    if (isNaN(stakeNum) || stakeNum <= 0 || stakeNum > 100000) { setError('Enter a valid stake greater than zero'); return; }
    setError('');
    const league = normalizeLeague(selectedGame.league) as BetLeague;
    const betPayload = {
      league,
      sport: league,
      homeTeam: selectedGame.homeTeam,
      awayTeam: selectedGame.awayTeam,
      game: selectedGame.awayTeam + ' @ ' + selectedGame.homeTeam,
      betType: betType as BetType,
      selection: selection.trim(),
      odds: oddsNum,
      stake: stakeNum,
      sportsbook,
      status: 'open' as const,
      payout: undefined,
      notes: notes.trim(),
      gameId: selectedGame.id,
      gameDate: selectedGame.gameTime ? selectedGame.gameTime.slice(0, 10) : new Date().toISOString().slice(0, 10),
    };
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await saveSupabaseBet(betPayload);
    } else {
      saveBet(betPayload);
    }
    setSelectedGameId('');
    setSelection('');
    setOdds('');
    setStake('');
    setNotes('');
    setBetType('moneyline');
    onBetAdded();
  }

  var inputStyle = { width: '100%', background: '#0a0e1a', border: '1px solid #1e3a5f', color: '#e2e8f0', padding: '6px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' as const };
  var labelStyle = { color: '#475569', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' as const, display: 'block', marginBottom: '4px', marginTop: '10px' };
  var selectStyle = Object.assign({}, inputStyle, { cursor: 'pointer' });

  // Group games by league
  const gamesByLeague: Record<string, any[]> = {};
  for (const g of allGames) {
    const league = normalizeLeague(g.league);
    if (!gamesByLeague[league]) gamesByLeague[league] = [];
    gamesByLeague[league].push(g);
  }

  return React.createElement('div', { style: { padding: '12px 16px' } },
    React.createElement('div', { style: { color: '#22c55e', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 'bold' } }, 'LOG A BET'),

    React.createElement('label', { style: labelStyle }, 'Game'),
    React.createElement('select', {
      value: selectedGameId,
      onChange: function(e: any) {
        setSelectedGameId(e.target.value);
        setSelection('');
        setOdds('');
      },
      style: selectStyle
    },
      React.createElement('option', { value: '' }, '-- Select a game --'),
      Object.entries(gamesByLeague).map(function([league, games]) {
        return React.createElement('optgroup', { key: league, label: league },
          games.map(function(g) {
            return React.createElement('option', { key: g.id, value: g.id },
              g.awayTeam + ' @ ' + g.homeTeam
            );
          })
        );
      })
    ),

    selectedGame && React.createElement('label', { style: labelStyle }, 'Bet Type'),
    selectedGame && React.createElement('select', {
      value: betType,
      onChange: function(e: any) { setBetType(e.target.value); setSelection(''); setOdds(''); },
      style: selectStyle
    },
      ['moneyline', 'spread', 'total'].map(function(t) {
        return React.createElement('option', { key: t, value: t }, t.charAt(0).toUpperCase() + t.slice(1));
      })
    ),

    selectedGame && selections.length > 0 && React.createElement('label', { style: labelStyle }, 'Selection'),
    selectedGame && selections.length > 0 && React.createElement('select', {
      value: selection,
      onChange: function(e: any) { handleSelectionChange(e.target.value); },
      style: selectStyle
    },
      React.createElement('option', { value: '' }, '-- Select --'),
      selections.map(function(s) {
        return React.createElement('option', { key: s.label, value: s.label }, s.label + ' (' + (s.odds > 0 ? '+' : '') + s.odds + ')');
      })
    ),

    selectedGame && selections.length === 0 && React.createElement('div', { style: { color: '#475569', fontSize: '11px', marginTop: '8px' } }, 'No odds available — enter manually:'),

    (selectedGame && (selections.length === 0)) && React.createElement('label', { style: labelStyle }, 'Selection'),
    (selectedGame && (selections.length === 0)) && React.createElement('input', {
      value: selection,
      onChange: function(e: any) { setSelection(e.target.value); },
      placeholder: 'e.g. Warriors ML',
      style: inputStyle
    }),

    React.createElement('label', { style: labelStyle }, 'Odds (American)'),
    React.createElement('input', {
      value: odds,
      onChange: function(e: any) { setOdds(e.target.value); },
      placeholder: '-110 or +150',
      style: inputStyle,
    }),

    React.createElement('label', { style: labelStyle }, 'Stake ($)'),
    React.createElement('input', {
      value: stake,
      onChange: function(e: any) { setStake(e.target.value); },
      placeholder: '25',
      style: inputStyle
    }),

    React.createElement('label', { style: labelStyle }, 'Notes (optional)'),
    React.createElement('input', {
      value: notes,
      onChange: function(e: any) { setNotes(e.target.value); },
      placeholder: 'Why you made this bet',
      style: inputStyle
    }),

    potentialPayout > 0 && React.createElement('div', { style: { marginTop: '10px', padding: '8px', background: '#0f1629', borderRadius: '4px', border: '1px solid #1e3a5f' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px' } },
        React.createElement('span', { style: { color: '#475569' } }, 'Stake'),
        React.createElement('span', { style: { color: '#e2e8f0' } }, '$' + stakeNum.toFixed(2))
      ),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' } },
        React.createElement('span', { style: { color: '#475569' } }, 'To Win'),
        React.createElement('span', { style: { color: '#22c55e', fontWeight: 'bold' } }, '$' + potentialPayout.toFixed(2))
      ),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' } },
        React.createElement('span', { style: { color: '#475569' } }, 'Total Return'),
        React.createElement('span', { style: { color: '#22c55e' } }, '$' + (stakeNum + potentialPayout).toFixed(2))
      )
    ),

    error && React.createElement('div', { style: { color: '#ef4444', fontSize: '11px', marginTop: '8px' } }, error),

    React.createElement('button', {
      onClick: handleSubmit,
      style: { width: '100%', marginTop: '12px', padding: '10px', background: '#22c55e', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, fontFamily: 'monospace', fontWeight: 'bold' }
    }, 'Log Bet')
  );
}
