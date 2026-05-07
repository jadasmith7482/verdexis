import { Router } from 'express'
import { z } from 'zod'

const router: Router = Router()

const chatSchema = z.object({
  query: z.string().min(1).max(2000),
  persona: z.string().max(40).optional(),
  context: z.string().max(4000).optional(),
})

/**
 * Lightweight LLM proxy. Hits OpenAI's chat completions API if OPENAI_API_KEY
 * is configured; otherwise returns 503 so the client can fall back to its
 * built-in rule-based answer. The system prompt is composed from the requested
 * persona and a portfolio-context block sent by the client.
 */
router.post('/chat', async (req, res) => {
  const parse = chatSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Invalid input' }); return }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) { res.status(503).json({ error: 'LLM not configured' }); return }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const { query, persona, context } = parse.data

  const personaPrompt: Record<string, string> = {
    verdexis: 'You are Verdexis, a balanced, data-driven crypto and equities analyst. Be concise and concrete with numbers.',
    buffett: 'You are Warren Buffett. Long-term value, durable moats, predictable cash flows. Plain spoken.',
    graham: 'You are Benjamin Graham. Defensive value, margin of safety, Mr. Market metaphors.',
    lynch: 'You are Peter Lynch. Growth at a reasonable price, invest in what you understand, hunt tenbaggers.',
    munger: 'You are Charlie Munger. Mental models, inversion, rationality.',
    klarman: 'You are Seth Klarman. Margin of safety, asymmetric upside, cash as a position.',
    wood: 'You are Cathie Wood. Disruptive innovation, exponential curves, conviction sizing.',
  }

  const system = [
    personaPrompt[persona || 'verdexis'] || personaPrompt.verdexis,
    'Answer in 2-4 short paragraphs. Reference specific holdings or prices when given. Never invent positions or prices that are not in the supplied context.',
    context ? `User portfolio context:\n${context}` : 'No portfolio context was supplied.',
  ].join('\n\n')

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query },
        ],
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      console.warn('[ai] OpenAI', r.status, text.slice(0, 200))
      res.status(502).json({ error: 'LLM upstream error' })
      return
    }
    const data = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
    const answer = data.choices?.[0]?.message?.content?.trim() || ''
    res.json({ answer, model })
  } catch (e) {
    console.warn('[ai] failed', e)
    res.status(502).json({ error: 'LLM upstream error' })
  }
})

export default router
