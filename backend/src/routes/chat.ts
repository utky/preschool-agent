import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { chatAgent } from '../agents/chat-agent.js'
import { logger } from '../lib/logger.js'
import type { ChatRequest, ChatSource } from '../types/chat.js'

const chat = new Hono()

chat.use('*', requireAuth)

const SEARCH_TOOL_NAMES = ['vectorSearch', 'titleSearch', 'keywordSearch'] as const

/** toolResultsからChatSource形式のソース一覧を抽出する（重複排除付き） */
function extractSources(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolResults: readonly any[]
): readonly ChatSource[] {
  const seen = new Set<string>()
  const sources: ChatSource[] = []

  for (const tr of toolResults) {
    if (SEARCH_TOOL_NAMES.includes(tr.toolName) && tr.result?.results) {
      for (const r of tr.result.results) {
        const key = `${r.document_id}:${r.chunk_index}`
        if (!seen.has(key)) {
          seen.add(key)
          sources.push({
            document_id: r.document_id,
            title: r.title,
            chunk_text: r.chunk_text,
            chunk_index: r.chunk_index,
          })
        }
      }
    }
  }
  return sources
}

chat.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()

  if (!body.message || body.message.trim().length === 0) {
    return c.json({ error: 'Message is required' }, 400)
  }

  try {
    const result = await chatAgent.generate(body.message)
    const sources = extractSources(result.toolResults ?? [])

    return c.json({ response: result.text, sources })
  } catch (error) {
    logger.error({ err: error }, 'Chat request failed')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default chat
