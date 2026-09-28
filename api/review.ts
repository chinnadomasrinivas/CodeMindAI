import { GeminiReviewError, reviewWithGemini } from '../server/gemini.js'
import type { ReviewInput } from '../server/gemini.js'

export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ code: 'invalid_json', error: 'Send a valid JSON review request.' }, { status: 400 })
  }

  try {
    return Response.json(await reviewWithGemini(body as ReviewInput))
  } catch (error) {
    if (error instanceof GeminiReviewError) {
      return Response.json({ code: error.code, error: error.message }, { status: error.status })
    }
    console.error('Unexpected Gemini review error.')
    return Response.json({ code: 'review_failed', error: 'The review could not be completed.' }, { status: 500 })
  }
}