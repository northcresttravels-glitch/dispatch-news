require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const SECTION_QUERIES = {
  world: 'world news',
  politics: 'politics government',
  technology: 'technology tech',
  business: 'business economy finance',
  science: 'science research',
  sports: 'sports',
  crypto: 'cryptocurrency bitcoin crypto',
  entertainment: 'entertainment celebrity movies',
  space: 'space nasa astronomy'
};

// Proxy images to avoid CORS
app.get('/api/image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('No url');
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Image fetch failed');
  }
});

// Fetch and extract full article text
app.get('/api/scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No url' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = await response.text();

    // Extract paragraphs from article body
    const paragraphs = [];

    // Remove scripts, styles, nav, footer, ads
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    // Extract <p> tags
    const pMatches = clean.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const p of pMatches) {
      const text = p.replace(/<[^>]+>/g, '').trim();
      if (text.length > 80) paragraphs.push(`<p>${text}</p>`);
    }

    if (paragraphs.length < 2) {
      return res.json({ body: '<p>Full article not available. Please visit the original source.</p>', scraped: false });
    }

    return res.json({ body: paragraphs.slice(0, 12).join('\n'), scraped: true });

  } catch (err) {
    console.error('Scrape error:', err);
    return res.json({ body: '<p>Could not load full article. Please visit the original source.</p>', scraped: false });
  }
});

// GET NEWS
app.get('/api/news', async (req, res) => {
  const section = (req.query.section || 'world').toLowerCase();
  const query = SECTION_QUERIES[section] || section;

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${process.env.NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok') {
      return res.status(500).json({ error: data.message || 'NewsAPI error' });
    }

    const stories = data.articles
      .filter(a => a.title && a.title !== '[Removed]')
      .map(a => ({
        headline: a.title?.replace(/\s*-\s*[^-]*$/, '') || 'No title',
        deck: a.description || '',
        source: a.source?.name || 'Unknown',
        url: a.url || '',
        image: a.urlToImage ? `/api/image?url=${encodeURIComponent(a.urlToImage)}` : '',
        publishedAt: a.publishedAt || ''
      }));

    return res.json({ section, stories });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running on port ${port}`));
