import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { extractKeywords, searchChunks, formatSearchResponse } from '../lib/chat-search.js'
import type { ChatRequest } from '../types/chat.js'

const chat = new Hono()

chat.use('*', requireAuth)

chat.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()

  if (!body.message || body.message.trim().length === 0) {
    return c.json({ error: 'Message is required' }, 400)
  }

  try {
    const keywords = extractKeywords(body.message)
    const sources = await searchChunks(keywords)
    const response = formatSearchResponse(keywords, sources)

    return c.json({ response, sources })
  } catch (error) {
    console.error('Chat search error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default chat
