import { getGroqHealth } from '../server/groq.js'

export function GET() {
  return Response.json(getGroqHealth(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}