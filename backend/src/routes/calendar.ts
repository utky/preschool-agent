import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { getApiData } from '../lib/storage.js'

const calendar = new Hono()

calendar.use('*', requireAuth)

// GET /api/calendar/events
// events/*.json は BigQuery EXPORT DATA が生成する JSONL 形式（1行1オブジェクト）
calendar.get('/events', async (c) => {
  const raw = await getApiData('events/000000000000.json')
  const events = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return c.json({ events })
})

export default calendar
