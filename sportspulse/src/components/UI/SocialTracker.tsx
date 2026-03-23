'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBets } from '@/lib/storage';
import { normalizeLeague } from '@/lib/leagues';

interface Post {
  id: string;
  source: string;
  handle: string;
  text: string;
  link: string;
  timestamp: Date;
  relevanceScore: number;
  relevanceReason: string;
  tags: string[];
}

interface SocialTrackerProps {
  games: any[];
  tickerOpen?: boolean;
  articles?: any[];
}

// Score a news item for relevance to the user
function scorePost(title: string, link: string, bets: any[], games: any[]): { score: number; reason: string; tags: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const tags: string[] = [];
  const titleLower = title.toLowerCase();

  // Check bet relevance
  for (const bet of bets) {
    if (bet.status !== 'open') continue;
    const betGame = bet.game.toLowerCase();
    const teams = betGame.split('@').map(function(t: string) { return t.trim().split(' ').pop()?.toLowerCase() || ''; });
    for (const team of teams) {
      if (team && titleLower.includes(team)) {
        score += 50;
        reasons.push('Bet: ' + bet.game);
        tags.push('BET');
        break;
      }
    }
  }

  // Check live game relevance
  for (const game of games) {
    if (game.status !== 'live') continue;
    const homeLast = game.homeTeam.split(' ').pop()?.toLowerCase() || '';
    const awayLast = game.awayTeam.split(' ').pop()?.toLowerCase() || '';
    if (titleLower.includes(homeLast) || titleLower.includes(awayLast)) {
      score += 30;
      tags.push('LIVE');
      break;
    }
  }

  // Keywords that boost score
  const hotKeywords = ['injury', 'suspended', 'trade', 'breaking', 'update', 'final', 'overtime', 'buzzer', 'upset', 'record'];
  for (const kw of hotKeywords) {
    if (titleLower.includes(kw)) { score += 15; tags.push(kw.toUpperCase()); }
  }

  // March Madness boost
  if (titleLower.includes('march madness') || titleLower.includes('ncaa tournament') || titleLower.includes('sweet 16') || titleLower.includes('elite 8') || titleLower.includes('final four')) {
    score += 25; tags.push('MARCH MADNESS');
  }

  const reason = reasons.length > 0 ? reasons[0] : tags.length > 0 ? tags[0] : 'General sports news';
  return { score, reason, tags: [...new Set(tags)] };
}

const SPORTS_HANDLES = [
  { handle: '@ESPN', source: 'ESPN' },
  { handle: '@SportsCenter', source: 'SportsCenter' },
  { handle: '@NBA', source: 'NBA' },
  { handle: '@NFL', source: 'NFL' },
  { handle: '@NHL', source: 'NHL' },
  { handle: '@MLB', source: 'MLB' },
  { handle: '@CBSSports', source: 'CBS Sports' },
  { handle: '@BleacherReport', source: 'Bleacher Report' },
  { handle: '@TheAthletic', source: 'The Athletic' },
  { handle: '@Stadium', source: 'Stadium' },
];

export default function SocialTracker({ games, tickerOpen = true, articles: passedArticles = [] }: SocialTrackerProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [visible, setVisible] = useState<Post | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<Post[]>([]);
  const indexRef = useRef(0);

  useEffect(function() {
    async function fetchAndScore() {
      try {
        const bets = getBets().filter(function(b) { return b.status === 'open'; });
        const articles = passedArticles.length > 0 ? passedArticles : [];

        const scored: Post[] = articles.map(function(article: any, i: number) {
          const { score, reason, tags } = scorePost(article.title, article.link, bets, games);
          const handleIdx = i % SPORTS_HANDLES.length;
          return {
            id: article.id,
            source: SPORTS_HANDLES[handleIdx].source,
            handle: SPORTS_HANDLES[handleIdx].handle,
            text: article.title,
            link: article.link,
            timestamp: new Date(Date.now() - Math.random() * 3600000),
            relevanceScore: score,
            relevanceReason: reason,
            tags,
          };
        });

        // Sort by relevance
        scored.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });
        setPosts(scored);
        queueRef.current = scored.filter(function(p) { return p.relevanceScore > 0; });
      } catch {}
    }

    fetchAndScore();
  }, [games, passedArticles]);

  // Cycle through relevant posts, showing each for 8 seconds
  useEffect(function() {
    if (queueRef.current.length === 0) return;
    function showNext() {
      const queue = queueRef.current;
      if (queue.length === 0) return;
      const post = queue[indexRef.current % queue.length];
      if (!dismissed.has(post.id)) {
        setVisible(post);
      }
      indexRef.current++;
    }

    showNext();
    timerRef.current = setInterval(showNext, 8000);
    return function() { if (timerRef.current) clearInterval(timerRef.current); };
  }, [posts]);

  function dismiss() {
    if (visible) {
      setDismissed(function(prev) { const next = new Set(prev); next.add(visible.id); return next; });
    }
    setVisible(null);
    setExpanded(false);
  }

  const relevantPosts = posts.filter(function(p) { return p.relevanceScore > 0 && !dismissed.has(p.id); });

  return React.createElement('div', {
    style: { position: 'fixed', bottom: '44px', left: tickerOpen ? '312px' : '48px', zIndex: 996, maxWidth: '320px', fontFamily: 'monospace', transition: 'left 0.2s ease' }
  },
    // Floating badge count
    relevantPosts.length > 0 && !expanded && !visible && React.createElement('button', {
      onClick: function() { setExpanded(true); },
      style: { background: '#0f1629', border: '1px solid #1e3a5f', color: '#60a5fa', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }
    }, 'SOCIAL (' + relevantPosts.length + ')'),

    // Expanded feed
    expanded && React.createElement('div', {
      style: { background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto', width: '320px' }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #1e3a5f' } },
        React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', letterSpacing: '1px', fontWeight: 'bold' } }, 'SOCIAL FEED'),
        React.createElement('button', { onClick: function() { setExpanded(false); }, style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' } }, 'X')
      ),
      relevantPosts.slice(0, 10).map(function(post) {
        return React.createElement('a', {
          key: post.id,
          href: post.link,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { display: 'block', padding: '8px 12px', borderBottom: '1px solid #1e3a5f', textDecoration: 'none', background: 'transparent' }
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '3px' } },
            React.createElement('span', { style: { color: '#60a5fa', fontSize: '9px' } }, post.handle),
            post.tags.slice(0, 2).map(function(tag, i) {
              return React.createElement('span', { key: i, style: { color: '#f59e0b', fontSize: '8px', background: '#162040', padding: '1px 4px', borderRadius: '2px', marginLeft: '3px' } }, tag);
            })
          ),
          React.createElement('div', { style: { color: '#e2e8f0', fontSize: '11px', lineHeight: '1.4' } }, post.text)
        );
      })
    ),

    // Popup notification
    visible && !expanded && React.createElement('div', {
      style: {
        background: '#0f1629', border: '1px solid ' + (visible.relevanceScore >= 50 ? '#f59e0b' : '#1e3a5f'),
        borderRadius: '6px', padding: '10px 12px', width: '300px',
        animation: 'slideUp 0.3s ease',
        boxShadow: visible.relevanceScore >= 50 ? '0 0 12px rgba(245,158,11,0.3)' : 'none',
      }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' } },
        React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
          React.createElement('span', { style: { color: '#60a5fa', fontSize: '10px', fontWeight: 'bold' } }, visible.handle),
          visible.tags.slice(0, 1).map(function(tag, i) {
            return React.createElement('span', { key: i, style: { color: '#f59e0b', fontSize: '8px', background: '#162040', padding: '1px 4px', borderRadius: '2px' } }, tag);
          })
        ),
        React.createElement('div', { style: { display: 'flex', gap: '4px' } },
          React.createElement('button', {
            onClick: function() { setExpanded(true); },
            style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace' }
          }, 'ALL'),
          React.createElement('button', { onClick: dismiss, style: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' } }, 'X')
        )
      ),
      React.createElement('a', {
        href: visible.link,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: { color: '#e2e8f0', fontSize: '11px', lineHeight: '1.4', textDecoration: 'none', display: 'block' }
      }, visible.text),
      React.createElement('div', { style: { color: '#475569', fontSize: '9px', marginTop: '4px' } },
        visible.relevanceReason
      )
    )
  );
}
