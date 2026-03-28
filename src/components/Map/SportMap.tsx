'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import venues from '@/data/venues.json';
import { Game } from '@/types/game';
import { LEAGUE_COLORS, SPORT_KEYS, leagueColor } from '@/lib/leagues';

interface SportMapProps {
  games: Game[];
  onVenueSelect: (venueId: string, venueName: string, team: string, gameId: string | null, sport: string | null) => void;
  activeLeagues: string[];
  selectedDate: string;
  highlightedGameId?: string | null;
}

type GameStatus = 'live' | 'upcoming' | 'final' | 'none';

function getDotStyle(league: string, status: GameStatus, highlighted: boolean) {
  const base = LEAGUE_COLORS[league] || '#94a3b8';
  const R = 8;
  if (highlighted) return { color: '#ffffff', fillColor: '#ffffff', fillOpacity: 1, opacity: 1, radius: R, weight: 3 };
  // Only LIVE games get 100% opacity with green border
  if (status === 'live') return { color: '#22c55e', fillColor: base, fillOpacity: 1, opacity: 1, radius: R + 3, weight: 3 };
  // Upcoming games: visible but clearly not live
  if (status === 'upcoming') return { color: base, fillColor: base, fillOpacity: 0.45, opacity: 0.6, radius: R, weight: 1 };
  // Final games: very dim
  if (status === 'final') return { color: base, fillColor: base, fillOpacity: 0.2, opacity: 0.3, radius: R, weight: 1 };
  // No game: barely visible
  return { color: base, fillColor: base, fillOpacity: 0.08, opacity: 0.15, radius: R, weight: 1 };
}

function toLocalDateString(utcString: string): string {
  if (!utcString) return '';
  const d = new Date(utcString);
  // Use local time to match selectedDate which is also local
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getGameStatus(game: any, selectedDate: string): GameStatus {
  if (!game) return 'none';
  // Live games should always show regardless of date string matching issues
  if (game.status === 'live') return 'live';
  if (game.status === 'final') {
    // Only show final if on selected date
    const gameDate = toLocalDateString(game.gameTime);
    if (gameDate && gameDate !== selectedDate) return 'none';
    return 'final';
  }
  // For scheduled games, check date matches
  const gameDate = toLocalDateString(game.gameTime);
  if (gameDate && gameDate !== selectedDate) return 'none';
  if (game.status === 'scheduled') return 'upcoming';
  // Time-based fallback
  const now = new Date();
  const gameTime = new Date(game.gameTime);
  const elapsed = now.getTime() - gameTime.getTime();
  if (elapsed > 5 * 60 * 60 * 1000) return 'final';
  if (elapsed > 5 * 60 * 1000) return 'live';
  return 'upcoming';
}

const STATUS_ORDER: Record<GameStatus, number> = { none: 0, final: 1, upcoming: 2, live: 3 };

// Component that auto-opens its tooltip when highlighted
function AutoTooltipMarker({ center, dotStyle, isHighlighted, onVenueSelect, venue, game, children }: any) {
  const markerRef = React.useRef<any>(null);

  React.useEffect(function() {
    if (isHighlighted && markerRef.current) {
      setTimeout(function() {
        try { markerRef.current.openTooltip(); } catch {}
      }, 100);
    } else if (!isHighlighted && markerRef.current) {
      try { markerRef.current.closeTooltip(); } catch {}
    }
  }, [isHighlighted]);

  return React.createElement(CircleMarker, {
    ref: markerRef,
    center,
    ...dotStyle,
    eventHandlers: {
      click: function() {
        onVenueSelect(
          venue.id,
          venue.name,
          venue.team,
          game ? game.id : null,
          game ? SPORT_KEYS[venue.league] : null
        );
      }
    }
  }, children);
}

export default function SportMap({ games, onVenueSelect, activeLeagues, selectedDate, highlightedGameId }: SportMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(function() { setMounted(true); }, []);

  if (!mounted) return React.createElement('div', { style: { height: '100vh', width: '100%', background: '#0a0e1a' } });

  // Only include venues whose league is currently active
  const activeVenues = venues.venues.filter(function(v) {
    return activeLeagues.includes(v.league);
  });

  // Deduplicate by location - for shared stadiums, keep the one with the best status
  // If tied, prefer the league whose filter button appears first
  const locKey = function(lat: number, lng: number) {
    return lat.toFixed(4) + ',' + lng.toFixed(4);
  };

  const locationMap: Record<string, {
    venue: any; game: any; status: GameStatus; highlighted: boolean;
  }> = {};

  for (const venue of activeVenues) {
    const venueTeamPrimary = venue.team.split(' / ')[0];
    const game = games.find(function(g) {
      // Pro sports: match home team only (game is played at home team's venue)
      if (g.homeTeam === venue.team || g.homeTeam === venueTeamPrimary) return true;
      // College neutral sites: match by exact venueName from ESPN
      if (g.venueName && venue.name) {
        const gv = g.venueName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const vn = venue.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (gv === vn) return true;
      }
      return false;
    });
    const status = getGameStatus(game, selectedDate);
    // Highlight ONLY the venue where the selected game is being played
    const highlighted = !!highlightedGameId && !!game && game.id === highlightedGameId;

    const key = locKey(venue.lat, venue.lng);
    const entry = { venue, game: status !== 'none' ? game : undefined, status, highlighted };

    if (!locationMap[key]) {
      locationMap[key] = entry;
    } else {
      const existing = locationMap[key];
      const newScore = STATUS_ORDER[status] + (highlighted ? 10 : 0);
      const oldScore = STATUS_ORDER[existing.status] + (existing.highlighted ? 10 : 0);
      if (newScore > oldScore) {
        locationMap[key] = entry;
      }
    }
  }

  const venueWithGame = Object.values(locationMap);

  const sorted = [...venueWithGame].sort(function(a, b) {
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  });

  return React.createElement(MapContainer, {
    center: [39, -95] as [number, number],
    zoom: 4,
    style: { height: '100vh', width: '100%', background: '#0a0e1a' }
  },
    React.createElement(TileLayer, {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: 'CartoDB'
    }),
    sorted.map(function({ venue, game, status, highlighted }) {
      const dotStyle = getDotStyle(venue.league, status, highlighted);
      const color = leagueColor(venue.league);
      return React.createElement(AutoTooltipMarker, {
        key: venue.id,
        center: [venue.lat, venue.lng] as [number, number],
        dotStyle,
        isHighlighted: highlighted,
        onVenueSelect,
        venue,
        game,
      },
        React.createElement(Tooltip, { direction: 'top', offset: [0, -8], opacity: 1 },
          React.createElement('div', {
            style: { fontFamily: 'monospace', fontSize: '12px', background: '#0f1629', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', border: '1px solid ' + color, minWidth: '160px' }
          },
            React.createElement('div', { style: { fontWeight: 'bold', marginBottom: '2px' } }, venue.name),
            React.createElement('div', { style: { color: color, fontSize: '10px', letterSpacing: '1px', marginBottom: '4px' } },
              venue.league + ' - ' + status.toUpperCase()
            ),
            game
              ? React.createElement('div', { style: { fontSize: '11px' } },
                  React.createElement('div', null, game.awayTeam + (status !== 'upcoming' ? ' ' + game.awayScore : '')),
                  React.createElement('div', null, game.homeTeam + (status !== 'upcoming' ? ' ' + game.homeScore : ''))
                )
              : React.createElement('div', { style: { color: '#475569', fontSize: '11px' } }, 'No game today')
          )
        )
      );
    })
  );
}
