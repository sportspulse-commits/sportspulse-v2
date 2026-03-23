'use client';

import React, { useEffect, useState, useRef } from 'react';

export default function NewsScroller({ articles: passedArticles = [] }: { articles?: any[] }) {
  const articles = passedArticles;
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef(null);
  const animRef = useRef(0);
  const posRef = useRef(0);

  useEffect(function() {
    var el = scrollRef.current;
    if (!el || articles.length === 0) return;
    var speed = 0.4;
    function animate() {
      if (!isPaused) {
        posRef.current -= speed;
        var half = el.scrollWidth / 2;
        if (Math.abs(posRef.current) >= half) { posRef.current = 0; }
        el.style.transform = 'translateX(' + posRef.current + 'px)';
      }
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return function() { cancelAnimationFrame(animRef.current); };
  }, [articles, isPaused]);

  if (articles.length === 0) return null;
  var doubled = articles.concat(articles);

  var wrapStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '36px', background: '#0a0e1a', borderTop: '1px solid #1e3a5f', zIndex: 997, overflow: 'hidden', display: 'flex', alignItems: 'center' };
  var trackStyle = { display: 'flex', alignItems: 'center', height: '100%', whiteSpace: 'nowrap', willChange: 'transform' };

  return (
    React.createElement('div', { style: wrapStyle, onMouseEnter: function() { setIsPaused(true); }, onMouseLeave: function() { setIsPaused(false); } },
      React.createElement('div', { style: { overflow: 'hidden', flex: 1, height: '100%', position: 'relative' } },
        React.createElement('div', { ref: scrollRef, style: trackStyle },
          doubled.map(function(article, i) {
            return React.createElement('div', { key: article.id + '-' + i, style: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 24px', borderRight: '1px solid #1e3a5f' } },
              React.createElement('span', { style: { color: '#475569', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', flexShrink: 0 } }, article.source.toUpperCase()),
              React.createElement('a', { href: article.link, target: '_blank', rel: 'noopener noreferrer', style: { color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace', textDecoration: 'none' } }, article.title)
            );
          })
        )
      )
    )
  );
}
