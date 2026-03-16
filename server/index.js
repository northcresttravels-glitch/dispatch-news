require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GROQ_API_KEY) {
  console.error('No GROQ_API_KEY found');
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/news', async (req, res) => {
  const section = (req.query.section || 'world').toLowerCase();
  const today = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  const prompt = `Today is ${today}. You are a wire news editor. Write 6 real, specific, factual news stories for the section: "${section}". Base them on real world events you know about. Be journalistic and specific — name real people, countries, organisations.

Return ONLY a valid JSON array, nothing else, no markdown, no backticks:
[
  {"headline":"...","deck":"...","source":"...","url":""},
  {"headline":"...","deck":"...","source":"...","url":""},
  {"headline":"...","deck":"...","source":"...","url":""},
  {"headline":"...","deck":"...","source":"...","url":""},
  {"headline":"...","deck":"...","source":"...","url":""},
  {"headline":"...","deck":"...","source":"...","url":""}
]

Rules:
- headline: under 12 words, factual, specific
- deck: 2-3 sentences of what happened and why it matters
- source: a real outlet (Reuters, AP, BBC, Bloomberg, NYT, FT, etc.)
- url: leave as empty string`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Groq error' });

    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ error: 'Could not parse response' });

    return res.json({ section, stories: JSON.parse(match[0]) });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running on port ${port}`));
