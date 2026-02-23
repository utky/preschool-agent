import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { getApiData } from '../lib/storage.js'
import { syncAllEvents } from '../lib/calendar.js'

const calendar = new Hono()

calendar.use('*', requireAuth)

// GET /api/calendar/events
// events/*.json は BigQuery EXPORT DATA が生成する JSONL 形式（1行1オブジェクト）
calendar.get('/events', async (c) => {
  const raw = await getApiData('events/000000000000.json')
  const events = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return c.json({ events })
})

// POST /api/calendar/sync（UI から手動トリガー）
calendar.post('/sync', async (c) => {
  const result = await syncAllEvents()
  return c.json(result)
})

export default calendar
