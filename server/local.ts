import 'dotenv/config'
import express from 'express'
import { GroqReviewError, getGroqHealth, reviewCode } from './groq.js'
import { getHindsightHealth, retainMemory } from './hindsight.js'

const app = express()
const port = Number(process.env.PORT) || 4174

app.use(express.json({ limit: '120kb' }))

app.get('/api/health', (_request, response) => {
  response.json(getGroqHealth())
})

app.post('/api/review', async (request, response) => {
  try {
    response.json(await reviewCode(request.body))
  } catch (error) {
    if (error instanceof GroqReviewError) {
      response.status(error.status).json({ code: error.code, error: error.message })
      return
    }
    console.error('Unexpected Groq review error.')
    response.status(500).json({ code: 'review_failed', error: 'The review could not be completed.' })
  }
})

app.listen(port, '127.0.0.1', () => {
  const health = getGroqHealth()
  console.log(`CodeMind API listening on http://127.0.0.1:${port} (${health.configured ? health.model : 'local checks only'})`)
})

app.post('/api/memory', async (request, response) => {
  const { content, context, language, source } = request.body ?? {}
  if (typeof content !== 'string' || !content.trim()) {
    response.status(400).json({ code: 'invalid_memory', error: 'Memory content is required.' })
    return
  }
  const stored = await retainMemory(content.trim().slice(0, 10_000), typeof context === 'string' ? context.slice(0, 200) : 'CodeMind team feedback', {
    language: typeof language === 'string' ? language.slice(0, 40) : 'unknown',
    source: typeof source === 'string' ? source.slice(0, 120) : 'codemind-feedback',
  })
  response.json({ stored, hindsight: getHindsightHealth().configured })
})