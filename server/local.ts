import 'dotenv/config'
import express from 'express'
import { GeminiReviewError, getGeminiHealth, reviewWithGemini } from './gemini.js'

const app = express()
const port = Number(process.env.PORT) || 4174

app.use(express.json({ limit: '120kb' }))

app.get('/api/health', (_request, response) => {
  response.json(getGeminiHealth())
})

app.post('/api/review', async (request, response) => {
  try {
    response.json(await reviewWithGemini(request.body))
  } catch (error) {
    if (error instanceof GeminiReviewError) {
      response.status(error.status).json({ code: error.code, error: error.message })
      return
    }
    console.error('Unexpected Gemini review error.')
    response.status(500).json({ code: 'review_failed', error: 'The review could not be completed.' })
  }
})

app.listen(port, '127.0.0.1', () => {
  const health = getGeminiHealth()
  console.log(`CodeMind API listening on http://127.0.0.1:${port} (${health.configured ? health.model : 'local checks only'})`)
})