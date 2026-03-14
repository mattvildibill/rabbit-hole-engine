import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const client = new Anthropic();

app.post('/api/expand', async (req, res) => {
  const { topic, parentTopic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }

  const context = parentTopic
    ? `The topic "${topic}" connects to "${parentTopic}".`
    : `The starting topic is "${topic}".`;

  const prompt = `You are the Rabbit Hole Engine — an infinitely curious explorer of ideas.

${context}

Generate exactly 5 niche, surprising subtopics that branch from "${topic}". Each should feel like a genuine rabbit hole: specific, weird, counterintuitive, or delightfully obscure. Avoid generic or obvious subtopics.

Return ONLY a valid JSON array (no markdown, no explanation) with exactly 5 objects. Each object must have:
- "title": 2–5 words, specific and intriguing (e.g. "Soviet rubber duck testing", not "rubber ducks")
- "connection": one sentence explaining the surprising link to "${topic}"
- "curiosity": one emoji that captures the vibe

Mix domains freely: science, history, folklore, food, engineering, biology, art, disasters, language, medicine. Be creative and specific.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse subtopics from model response' });
    }

    const subtopics = JSON.parse(jsonMatch[0]);
    res.json({ subtopics });
  } catch (err) {
    console.error('API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve built frontend in production
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rabbit Hole Engine running on http://localhost:${PORT}`));
