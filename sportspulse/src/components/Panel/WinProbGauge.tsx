'use client';

import React from 'react';

interface WinProbGaugeProps {
  homeProb: number;
  awayProb: number;
  homeTeam: string;
  awayTeam: string;
  source?: string;
}

export default function WinProbGauge({ homeProb, awayProb, homeTeam, awayTeam, source }: WinProbGaugeProps) {
  const awayShort = (awayTeam || '').split(' ').pop() || awayTeam;
  const homeShort = (homeTeam || '').split(' ').pop() || homeTeam;
  const tied = awayProb === homeProb;
  const awayLeading = awayProb > homeProb;
  const awayColor = tied ? '#94a3b8' : awayLeading ? '#22c55e' : '#ef4444';
  const homeColor = tied ? '#94a3b8' : awayLeading ? '#ef4444' : '#22c55e';

  return (
    <div style={{ fontFamily: 'monospace', padding: '8px 0 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#94a3b8', fontSize: '9px', letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{awayShort}</div>
          <div style={{ color: awayColor, fontSize: '22px', fontWeight: 'bold', lineHeight: 1 }}>{awayProb}%</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
          <div style={{ color: '#475569', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>Win Prob</div>
          {source && <div style={{ color: '#1e3a5f', fontSize: '8px', marginTop: '2px' }}>{source}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#94a3b8', fontSize: '9px', letterSpacing: '1px', marginBottom: '2px', textTransform: 'uppercase' }}>{homeShort}</div>
          <div style={{ color: homeColor, fontSize: '22px', fontWeight: 'bold', lineHeight: 1 }}>{homeProb}%</div>
        </div>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', background: '#1e3a5f' }}>
        <div style={{ width: awayProb + '%', background: awayColor, transition: 'width 0.6s ease', borderRadius: '4px 0 0 4px' }} />
        <div style={{ width: homeProb + '%', background: homeColor, transition: 'width 0.6s ease', borderRadius: '0 4px 4px 0' }} />
      </div>
    </div>
  );
}
