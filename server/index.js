require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('No API key found');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/news', async (req, res) => {
  const section = (req.query.section || 'world').toLowerCase();
  const today = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  const systemPrompt = `You are a wire news editor. Search the web for today's most important real news stories. Always use the web_search tool first. After searching, return ONLY a valid JSON array — no markdown, no backticks, no preamble. Exactly 6 objects with keys: headline, deck, source, url.`;

  const userPrompt = `Today is ${today}. Find the 6 most significant current news stories for: "${section}". Use web search first. Then return ONLY this JSON, nothing else:
[{"headline":"...","deck":"...","source":"...","url":"..."}]`;

  try {
    const messages = [{ role: 'user', content: userPrompt }];
    let finalText = '';

    for (let turn = 0; turn < 10; turn++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        finalText = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n');
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = response.content
          .filter(b => b.type === 'tool_use')
          .map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: b.content ? JSON.stringify(b.content) : 'Search completed.'
          }));
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      const fallback = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (fallback) { finalText = fallback; break; }
      break;
    }

    if (!finalText) return res.status(500).json({ error: 'No response from model' });

    const clean = finalText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
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
