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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running on port ${port}`));
