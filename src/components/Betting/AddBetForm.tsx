'use client';

import React, { useState, useEffect } from 'react';
import { saveBet, calcPayout, BetLeague, BetType } from '@/lib/storage';
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
  const potentialPayout = (!isNaN(oddsNum) && !isNaN(stakeNum) && stakeNum > 0) ? calcPayout(stakeNum, oddsNum) : 0;

  function resetForm() {
    setSelectedGameId("");
    setIsManualMode(false);
    setManualBetName("");
    setSelection("");
    setOdds("");
    setStake("");
    setNotes("");
    setBetType("moneyline");
    setError("");
  }

  async function handleSubmit() {
    if (!isManualMode && !selectedGame) { setError("Select a game"); return; }
    if (isManualMode && !manualBetName.trim()) { setError("Enter a bet name"); return; }
    if (!selection.trim()) { setError("Enter your pick"); return; }
    if (isNaN(oddsNum)) { setError("Enter valid odds"); return; }
    if (isNaN(stakeNum) || stakeNum <= 0) { setError("Enter a valid stake greater than zero"); return; }
    setError("");

    const league = (isManualMode ? "NBA" : normalizeLeague(selectedGame!.league)) as BetLeague;
    const gameName = isManualMode ? manualBetName.trim() : (selectedGame!.awayTeam + " @ " + selectedGame!.homeTeam);

    const betPayload = {
      league,
      sport: league,
      homeTeam: isManualMode ? manualBetName.trim() : selectedGame!.homeTeam,
      awayTeam: isManualMode ? "" : selectedGame!.awayTeam,
      game: gameName,
      betType: betType as BetType,
      selection: selection.trim(),
      odds: oddsNum,
      stake: stakeNum,
      sportsbook,
      status: "open" as const,
      payout: undefined,
      notes: notes.trim(),
      gameId: isManualMode ? null : selectedGame!.id,
      gameDate: isManualMode ? new Date().toISOString().slice(0, 10) : (selectedGame!.gameTime ? selectedGame!.gameTime.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await saveSupabaseBet(betPayload);
      resetForm();
      onBetAdded();
    } else {
      saveBet(betPayload);
      resetForm();
      setError("Not logged in - bet saved locally only. Log in to save permanently.");
      onBetAdded();
    }
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
    React.createElement("div", { style: { color: "#22c55e", fontSize: "11px", letterSpacing: "2px", marginBottom: "12px", fontWeight: "bold" } }, "LOG A BET"),

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