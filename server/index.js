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

    const stories = data.articles.map(a => ({
      headline: a.title?.replace(/\s*-\s*[^-]*$/, '') || 'No title',
      deck: a.description || '',
      source: a.source?.name || 'Unknown',
      url: a.url || '',
      image: a.urlToImage || '',
      publishedAt: a.publishedAt || ''
    }));

    return res.json({ section, stories });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// GET FULL ARTICLE
app.get('/api/article', async (req, res) => {
  const { headline, deck, source } = req.query;
  if (!headline) return res.status(400).json({ error: 'No headline provided' });

  const prompt = `You are a journalist at ${source || 'a major news outlet'}. Write a full news article based on this:

Headline: ${headline}
Summary: ${deck || ''}

Write 5 paragraphs of proper news article body text. Start with a dateline. Be factual, specific, and journalistic. No fluff. Write it as if it is a real wire report.

Return ONLY the article paragraphs as HTML, each wrapped in <p> tags. Nothing else.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Groq error' });

    const body = data.choices?.[0]?.message?.content || '<p>Article not available.</p>';
    return res.json({ body });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running on port ${port}`));
