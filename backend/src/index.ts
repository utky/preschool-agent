import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { corsMiddleware } from './middleware/cors.js'
import { httpLogger } from './middleware/logger.js'
import { authMiddleware } from './middleware/auth.js'
import auth from './routes/auth.js'
import health from './routes/health.js'
import documents from './routes/documents.js'
import chat from './routes/chat.js'
import { logger } from './lib/logger.js'
import { getFrontendIndex } from './lib/storage.js'

const app = new Hono()

app.use('*', httpLogger)
app.use('*', corsMiddleware)
app.use('/api/*', authMiddleware)

app.route('/api/auth', auth)
app.route('/api/health', health)
app.route('/api/documents', documents)
app.route('/api/chat', chat)

app.get('/', async (c) => {
  try {
    const html = await getFrontendIndex()
    return c.html(html)
  } catch (error) {
    logger.error({ err: error }, 'Failed to serve frontend')
    return c.text('Frontend not available', 500)
  }
})

const port = parseInt(process.env.PORT || '3000', 10)

logger.info({ port }, 'Server started')

serve({
  fetch: app.fetch,
  port,
})
