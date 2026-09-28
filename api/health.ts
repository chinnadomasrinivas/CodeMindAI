import { getGeminiHealth } from '../server/gemini.js'

export function GET() {
  return Response.json(getGeminiHealth(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}