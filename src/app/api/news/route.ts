import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const feeds = [
      { url: 'https://www.espn.com/espn/rss/news', source: 'ESPN' },
      { url: 'https://sports.yahoo.com/rss/', source: 'Yahoo Sports' },
    ];

    const results = await Promise.allSettled(
      feeds.map(function(feed) {
        return fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          next: { revalidate: 300 }
        })
          .then(function(r) { return r.text(); })
          .then(function(text) { return { text, source: feed.source }; });
      })
    );

    const articles: any[] = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { text, source } = result.value;
      const items = text.match(/<item[^>]*>([\s\S]*?)<\/item>/g) || [];

      for (const item of items.slice(0, 15)) {
        // Extract title
        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';

        // Extract link - ESPN puts the URL between <link> and </link> or in a CDATA
        // Yahoo puts it in <feedburner:origLink> or <guid>
        let link = '';

        // Try feedburner original link first (Yahoo)
        const fbMatch = item.match(/<feedburner:origLink[^>]*>([\s\S]*?)<\/feedburner:origLink>/);
        if (fbMatch) link = fbMatch[1].trim();

        // Try <link> tag - handle both inline and CDATA
        if (!link) {
          const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[\s\S]*?)(?:\]\]>)?<\/link>/);
          if (linkMatch) link = linkMatch[1].trim();
        }

        // Try <link> followed by URL on next line (ESPN format)
        if (!link) {
          const linkMatch2 = item.match(/<link[^>]*>\s*(https?:\/\/[^\s<]+)/);
          if (linkMatch2) link = linkMatch2[1].trim();
        }

        // Try guid with isPermaLink
        if (!link) {
          const guidMatch = item.match(/<guid[^>]*isPermaLink="true"[^>]*>(https?:\/\/[^<]+)<\/guid>/);
          if (guidMatch) link = guidMatch[1].trim();
        }

        // Try any guid that looks like a URL
        if (!link) {
          const guidMatch2 = item.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/);
          if (guidMatch2) link = guidMatch2[1].trim();
        }

        if (title && title.length > 5 && link.startsWith('http')) {
          articles.push({
            id: source + '-' + articles.length,
            title,
            link,
            source,
          });
        }
      }
    }

    return NextResponse.json({ articles: articles.slice(0, 30) });
  } catch (error) {
    return NextResponse.json({ articles: [], error: 'Failed to fetch news' }, { status: 500 });
  }
}
