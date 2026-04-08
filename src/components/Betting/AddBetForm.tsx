'use client';

import React, { useState, useEffect } from 'react';
import { saveBet, calcProfit, BetLeague, BetType } from '@/lib/storage';
import { saveSupabaseBet } from '@/lib/supabase-storage';
import { supabase } from '@/lib/supabase/client';
import { normalizeLeague } from '@/lib/leagues';

interface AddBetFormProps {
  onBetAdded: () => void;
  defaultSportsbook?: string;
  allGames?: any[];
  allOdds?: Record<string, any>;
}

export default function AddBetForm({ onBetAdded, defaultSportsbook = "DraftKings", allGames = [], allOdds = {} }: AddBetFormProps) {
  const [selectedGameId, setSelectedGameId] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBetName, setManualBetName] = useState("");
  const [betType, setBetType] = useState("moneyline");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [sportsbook, setSportsbook] = useState(defaultSportsbook);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrGameId, setOcrGameId] = useState<string | null>(null);
  const [ocrGameDate, setOcrGameDate] = useState<string>('');
  const [ocrLeague, setOcrLeague] = useState<string>('');
  const [ocrHomeTeam, setOcrHomeTeam] = useState<string>('');
  const [ocrAwayTeam, setOcrAwayTeam] = useState<string>('');
  const [ocrIsSettled, setOcrIsSettled] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrPayout, setOcrPayout] = useState<number | null>(null);
  const [oddsMap, setOddsMap] = useState<Record<string, any>>({});

  useEffect(function() { setSportsbook(defaultSportsbook); }, [defaultSportsbook]);

  const selectedGame = allGames.find(function(g) { return g.id === selectedGameId; });
  const oddsData = oddsMap[selectedGameId];

  useEffect(function() {
    if (!selectedGame) return;
    const hk = (selectedGame.homeTeam || "").split(" ").pop()?.toLowerCase() || "";
    const ak = (selectedGame.awayTeam || "").split(" ").pop()?.toLowerCase() || "";
    const key = ak + "@" + hk;
    const odd = allOdds[key];
    if (!odd) return;
    const book = odd.bookmakers && (
      odd.bookmakers.find(function(b: any) { return b.title.toLowerCase() === sportsbook.toLowerCase(); }) ||
      odd.bookmakers[0]
    );
    if (!book) return;
    const h2h = book.markets?.find(function(m: any) { return m.key === "h2h"; });
    const spreads = book.markets?.find(function(m: any) { return m.key === "spreads"; });
    const totals = book.markets?.find(function(m: any) { return m.key === "totals"; });
    setOddsMap(function(prev) {
      return Object.assign({}, prev, {
        [selectedGame.id]: { event: odd, h2h, spreads, totals, home: odd.home_team, away: odd.away_team }
      });
    });
  }, [selectedGame?.id, sportsbook]);

  function getSelections(): { label: string; odds: number; point?: number }[] {
    if (!oddsData) return [];
    function fmt(o: any, name: string) { if (!o) return null; return { label: name, odds: o.price, point: o.point }; }
    function byName(outcomes: any[], name: string) { return outcomes?.find(function(o: any) { return o.name === name; }); }
    if (betType === "moneyline" && oddsData.h2h) {
      return [fmt(byName(oddsData.h2h.outcomes, oddsData.away), oddsData.away + " ML"), fmt(byName(oddsData.h2h.outcomes, oddsData.home), oddsData.home + " ML")].filter(Boolean) as any[];
    }
    if (betType === "spread" && oddsData.spreads) {
      return [
        fmt(byName(oddsData.spreads.outcomes, oddsData.away), oddsData.away + " " + (byName(oddsData.spreads.outcomes, oddsData.away)?.point > 0 ? "+" : "") + byName(oddsData.spreads.outcomes, oddsData.away)?.point),
        fmt(byName(oddsData.spreads.outcomes, oddsData.home), oddsData.home + " " + (byName(oddsData.spreads.outcomes, oddsData.home)?.point > 0 ? "+" : "") + byName(oddsData.spreads.outcomes, oddsData.home)?.point),
      ].filter(Boolean) as any[];
    }
    if (betType === "total" && oddsData.totals) {
      return [
        fmt(oddsData.totals.outcomes?.find(function(o: any) { return o.name === "Over"; }), "Over " + oddsData.totals.outcomes?.find(function(o: any) { return o.name === "Over"; })?.point),
        fmt(oddsData.totals.outcomes?.find(function(o: any) { return o.name === "Under"; }), "Under " + oddsData.totals.outcomes?.find(function(o: any) { return o.name === "Under"; })?.point),
      ].filter(Boolean) as any[];
    }
    return [];
  }

  const selections = getSelections();

  function handleSelectionChange(label: string) {
    setSelection(label);
    const found = selections.find(function(s) { return s.label === label; });
    if (found) setOdds(String(found.odds > 0 ? "+" + found.odds : found.odds));
  }

  const oddsNum = parseFloat(odds);
  const stakeNum = parseFloat(stake);
  const potentialPayout = (!isNaN(oddsNum) && !isNaN(stakeNum) && stakeNum > 0) ? calcProfit(stakeNum, oddsNum) : 0;

  function resetForm() {
    setSelectedGameId(''); setIsManualMode(false); setManualBetName(''); setSelection(''); setOdds(''); setStake(''); setNotes(''); setBetType('moneyline'); setError(''); setOcrError('');
    setOcrGameId(null); setOcrGameDate(''); setOcrLeague(''); setOcrHomeTeam(''); setOcrAwayTeam(''); setOcrIsSettled(false); setOcrResult(null); setOcrPayout(null);
  }
  async function handleOCR(file: File) {
    setOcrLoading(true); setOcrError('');
    try {
      // Step 1: Compress image to max 800px to minimize API tokens
      const compressedBase64 = await new Promise<{ base64: string; mediaType: string }>(function(resolve, reject) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = function() {
          URL.revokeObjectURL(objectUrl);
          const maxDim = 800;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Step 2: Extract bet details via Claude Vision
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: compressedBase64.base64, mediaType: compressedBase64.mediaType })
      });
      if (!ocrRes.ok) { setOcrError('Could not read bet slip. Please fill in manually.'); setOcrLoading(false); return; }
      const ocrData = await ocrRes.json();
      if (ocrData.error) { setOcrError(ocrData.error); setOcrLoading(false); return; }
      const parsed = ocrData.result;

      // Step 3: Populate form fields from OCR result
      if (parsed.betType) setBetType(parsed.betType);
      if (parsed.selection) setSelection(parsed.selection);
      if (parsed.odds !== undefined) setOdds(parsed.odds > 0 ? '+' + parsed.odds : String(parsed.odds));
      if (parsed.stake !== undefined) setStake(String(parsed.stake));
      if (parsed.sportsbook) setSportsbook(parsed.sportsbook);

      // Step 4: Match game via ESPN to get gameId
      const matchRes = await fetch('/api/ocr/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: parsed.homeTeam || '',
          awayTeam: parsed.awayTeam || '',
          league: parsed.league || '',
          rawDate: parsed.rawDate || '',
          selection: parsed.selection || '',
        })
      });
      const matchData = matchRes.ok ? await matchRes.json() : null;

      // Step 5: Set game info — use matched ESPN game or fall back to manual
      if (matchData && matchData.matched && matchData.gameId) {
        // Found ESPN game — use real game data
        const gameName = matchData.awayTeam + ' @ ' + matchData.homeTeam;
        setIsManualMode(true);
        setSelectedGameId('other');
        setManualBetName(gameName);
        // Store gameId and date for submission — use hidden state
        setOcrGameId(matchData.gameId);
        setOcrGameDate(matchData.gameDate);
        setOcrLeague(matchData.league);
        setOcrHomeTeam(matchData.homeTeam);
        setOcrAwayTeam(matchData.awayTeam);
      } else {
        // No ESPN match — use OCR team names directly
        const gameName = parsed.awayTeam && parsed.homeTeam
          ? parsed.awayTeam + ' @ ' + parsed.homeTeam
          : parsed.homeTeam || parsed.awayTeam || 'Unknown Game';
        setIsManualMode(true);
        setSelectedGameId('other');
        setManualBetName(gameName);
        setOcrGameId(null);
        const parsedDate = parsed.rawDate ? parsed.rawDate : new Date().toISOString().slice(0, 10);
        setOcrGameDate(parsedDate);
        setOcrLeague(parsed.league || '');
        setOcrHomeTeam(parsed.homeTeam || '');
        setOcrAwayTeam(parsed.awayTeam || '');
      }

      // Step 6: If already settled, pre-fill result for immediate save
      if (parsed.isSettled && parsed.result) {
        setOcrIsSettled(true);
        setOcrResult(parsed.result);
        setOcrPayout(parsed.payout || null);
        setNotes((notes ? notes + ' | ' : '') + 'Auto-settled from bet slip scan');
      } else {
        setOcrIsSettled(false);
        setOcrResult(null);
        setOcrPayout(null);
      }

    } catch(e) {
      console.error('OCR error:', e);
      setOcrError('Could not read bet slip. Please fill in manually.');
    }
    setOcrLoading(false);
  }


  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    if (!isManualMode && !selectedGame) { setError('Select a game'); setSubmitting(false); return; }
    if (isManualMode && !manualBetName.trim()) { setError('Enter a bet name'); setSubmitting(false); return; }
    if (!selection.trim()) { setError('Enter your pick'); setSubmitting(false); return; }
    if (isNaN(oddsNum) || (oddsNum > -100 && oddsNum < 100)) { setError('Odds must be +100 or greater, or -100 or less (e.g. -110, +150)'); setSubmitting(false); return; }
    if (isNaN(stakeNum) || stakeNum <= 0) { setError('Enter a valid stake greater than zero'); setSubmitting(false); return; }
    setError('');

    // Determine league — use OCR league if available, else derive from game
    const rawLeague = ocrLeague || (isManualMode ? 'NBA' : normalizeLeague(selectedGame!.league));
    const league = rawLeague as BetLeague;

    // Determine game names — prefer OCR-matched ESPN data
    const homeTeam = ocrHomeTeam || (isManualMode ? manualBetName.trim() : selectedGame!.homeTeam);
    const awayTeam = ocrAwayTeam || (isManualMode ? '' : selectedGame!.awayTeam);
    const gameName = awayTeam ? awayTeam + ' @ ' + homeTeam : homeTeam;

    // Determine gameId — prefer OCR-matched, then selected game
    const gameId = ocrGameId || (isManualMode ? null : selectedGame!.id);

    // Determine game date — prefer OCR date, then game time, then today
    const gameDate = ocrGameDate ||
      (isManualMode ? new Date().toISOString().slice(0, 10) :
      (selectedGame!.gameTime ? selectedGame!.gameTime.slice(0, 10) : new Date().toISOString().slice(0, 10)));

    // Determine status and payout — pre-settle if OCR detected result
    let status: 'open' | 'won' | 'lost' | 'push' = 'open';
    let payout: number | undefined = undefined;
    if (ocrIsSettled && ocrResult) {
      status = ocrResult as 'won' | 'lost' | 'push';
      if (ocrResult === 'won') {
        // Use OCR payout if available, otherwise calculate
        payout = ocrPayout || (oddsNum > 0 ? stakeNum + stakeNum * (oddsNum / 100) : stakeNum + stakeNum * (100 / Math.abs(oddsNum)));
      } else if (ocrResult === 'push') {
        payout = stakeNum;
      } else {
        payout = 0;
      }
    }

    const betPayload = {
      league,
      sport: league,
      homeTeam,
      awayTeam,
      game: gameName,
      betType: betType as BetType,
      selection: selection.trim(),
      odds: oddsNum,
      stake: stakeNum,
      sportsbook,
      status,
      payout,
      notes: notes.trim(),
      gameId,
      gameDate,
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await saveSupabaseBet(betPayload);
      resetForm();
      onBetAdded();
    } else {
      saveBet(betPayload);
      resetForm();
      setError('Not logged in - bet saved locally only. Log in to save permanently.');
      onBetAdded();
    }
    setSubmitting(false);
  }

  const inputStyle = { width: "100%", background: "#0a0e1a", border: "1px solid #1e3a5f", color: "#e2e8f0", padding: "6px 8px", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px", boxSizing: "border-box" as const };
  const labelStyle = { color: "#475569", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" as const, display: "block", marginBottom: "4px", marginTop: "10px" };
  const selectStyle = Object.assign({}, inputStyle, { cursor: "pointer" });

  const gamesByLeague: Record<string, any[]> = {};
  for (const g of allGames) {
    const league = normalizeLeague(g.league);
    if (!gamesByLeague[league]) gamesByLeague[league] = [];
    gamesByLeague[league].push(g);
  }

  return React.createElement("div", { style: { padding: "12px 16px" } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } }, React.createElement('div', { style: { color: '#22c55e', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold' } }, 'LOG A BET'), React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: ocrLoading ? 'wait' : 'pointer', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', color: '#60a5fa', fontFamily: 'monospace', letterSpacing: '1px' } }, ocrLoading ? String.fromCodePoint(0x23F3) + ' READING...' : String.fromCodePoint(0x1F4F7) + ' SCAN SLIP', React.createElement('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: function(e) { const f = e.target.files && e.target.files[0]; if (f) handleOCR(f); e.target.value = ''; } }))),
    ocrError ? React.createElement('div', { style: { color: '#f59e0b', fontSize: '10px', marginBottom: '8px', padding: '6px 8px', background: '#1a0f00', borderRadius: '4px', border: '1px solid #f59e0b' } }, ocrError) : null,

    React.createElement("label", { style: labelStyle }, "Game"),
    React.createElement("select", {
      value: selectedGameId,
      onChange: function(e: any) {
        const val = e.target.value;
        if (val === "other") { setIsManualMode(true); setSelectedGameId("other"); }
        else { setIsManualMode(false); setSelectedGameId(val); }
        setSelection(""); setOdds("");
      },
      style: selectStyle
    },
      React.createElement("option", { value: "" }, "-- Select a game --"),
      Object.entries(gamesByLeague).map(function([league, games]) {
        return React.createElement("optgroup", { key: league, label: league },
          games.map(function(g) {
            return React.createElement("option", { key: g.id, value: g.id }, g.awayTeam + " @ " + g.homeTeam);
          })
        );
      }),
      React.createElement("option", { value: "other" }, "-- Other (enter manually) --")
    ),

    isManualMode && React.createElement("div", null,
      React.createElement("label", { style: labelStyle }, "Bet Name"),
      React.createElement("input", { value: manualBetName, onChange: function(e: any) { setManualBetName(e.target.value); }, placeholder: "e.g. LeBron Over 24.5 Points", style: inputStyle })
    ),

    React.createElement("label", { style: labelStyle }, "Bet Type"),
    React.createElement("select", {
      value: betType,
      onChange: function(e: any) { setBetType(e.target.value); setSelection(""); setOdds(""); },
      style: selectStyle
    },
      ["moneyline", "spread", "total", "prop", "parlay", "futures"].map(function(t) {
        return React.createElement("option", { key: t, value: t }, t.charAt(0).toUpperCase() + t.slice(1));
      })
    ),

    !isManualMode && selectedGame && selections.length > 0 && React.createElement("label", { style: labelStyle }, "Selection"),
    !isManualMode && selectedGame && selections.length > 0 && React.createElement("select", {
      value: selection, onChange: function(e: any) { handleSelectionChange(e.target.value); }, style: selectStyle
    },
      React.createElement("option", { value: "" }, "-- Select --"),
      selections.map(function(s) {
        return React.createElement("option", { key: s.label, value: s.label }, s.label + " (" + (s.odds > 0 ? "+" : "") + s.odds + ")");
      })
    ),

    (isManualMode || !selectedGame || selections.length === 0) && React.createElement("label", { style: labelStyle }, "Your Pick"),
    (isManualMode || !selectedGame || selections.length === 0) && React.createElement("input", {
      value: selection, onChange: function(e: any) { setSelection(e.target.value); },
      placeholder: isManualMode ? "e.g. LeBron Over 24.5" : "e.g. Warriors ML", style: inputStyle
    }),

    React.createElement("label", { style: labelStyle }, "Odds (American)"),
    React.createElement("input", { value: odds, onChange: function(e: any) { setOdds(e.target.value); }, placeholder: "-110 or +150", style: inputStyle }),

    React.createElement("label", { style: labelStyle }, "Stake ($)"),
    React.createElement("input", { value: stake, onChange: function(e: any) { setStake(e.target.value); }, placeholder: "25", style: inputStyle }),

    React.createElement("label", { style: labelStyle }, "Notes (optional)"),
    React.createElement("input", { value: notes, onChange: function(e: any) { setNotes(e.target.value); }, placeholder: "Why you made this bet", style: inputStyle }),

    potentialPayout > 0 && React.createElement("div", { style: { marginTop: "10px", padding: "8px", background: "#0f1629", borderRadius: "4px", border: "1px solid #1e3a5f" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px" } },
        React.createElement("span", { style: { color: "#475569" } }, "Stake"),
        React.createElement("span", { style: { color: "#e2e8f0" } }, "$" + stakeNum.toFixed(2))
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "4px" } },
        React.createElement("span", { style: { color: "#475569" } }, "To Win"),
        React.createElement("span", { style: { color: "#22c55e", fontWeight: "bold" } }, "$" + potentialPayout.toFixed(2))
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "4px" } },
        React.createElement("span", { style: { color: "#475569" } }, "Total Return"),
        React.createElement("span", { style: { color: "#22c55e" } }, "$" + (stakeNum + potentialPayout).toFixed(2))
      )
    ),

    error && React.createElement("div", { style: { color: error.includes("Not logged") ? "#f59e0b" : "#ef4444", fontSize: "11px", marginTop: "8px" } }, error),

    React.createElement("button", {
      onClick: handleSubmit,
      style: { width: "100%", marginTop: "12px", padding: "10px", background: "#22c55e", border: "none", color: "#000", borderRadius: "4px", cursor: "pointer", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" as const, fontFamily: "monospace", fontWeight: "bold" }
    }, "Log Bet")
  );
}
