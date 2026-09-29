import { getHindsightHealth, retainMemory } from '../server/hindsight.js'

export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ code: 'invalid_json', error: 'Send a valid JSON memory request.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || typeof (body as { content?: unknown }).content !== 'string') {
    return Response.json({ code: 'invalid_memory', error: 'Memory content is required.' }, { status: 400 })
  }

  const input = body as { content: string; context?: unknown; language?: unknown; source?: unknown }
  const content = input.content.trim().slice(0, 10_000)
  if (!content) return Response.json({ code: 'empty_memory', error: 'Memory content is required.' }, { status: 400 })

  const stored = await retainMemory(
    content,
    typeof input.context === 'string' ? input.context.slice(0, 200) : 'CodeMind team feedback',
    {
      language: typeof input.language === 'string' ? input.language.slice(0, 40) : 'unknown',
      source: typeof input.source === 'string' ? input.source.slice(0, 120) : 'codemind-feedback',
    },
  )
  return Response.json({ stored, hindsight: getHindsightHealth().configured })
}
