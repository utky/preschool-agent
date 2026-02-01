import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { corsMiddleware } from './middleware/cors.js'
import { authMiddleware } from './middleware/auth.js'
import auth from './routes/auth.js'
import health from './routes/health.js'
import documents from './routes/documents.js'
import { getFrontendIndex } from './lib/storage.js'

const app = new Hono()

app.use('*', logger())
app.use('*', corsMiddleware)
app.use('/api/*', authMiddleware)

app.route('/api/auth', auth)
app.route('/api/health', health)
app.route('/api/documents', documents)

app.get('/', async (c) => {
  try {
    const html = await getFrontendIndex()
    return c.html(html)
  } catch (error) {
    console.error('Failed to serve frontend:', error)
    return c.text('Frontend not available', 500)
  }
})

const port = parseInt(process.env.PORT || '3000', 10)

console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
