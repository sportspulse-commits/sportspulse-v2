export interface Game {
  id: string;
  league: 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAAF' | 'NCAAB' | 'MMA' | 'F1';
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'live' | 'final';
  gameTime: string;
  venueName?: string;
  clock?: string;
  period?: number;
  statusDetail?: string;
  venueId?: string;
  winProb?: {
    home: number;
    away: number;
    model: string;
  };
}