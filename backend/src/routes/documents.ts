import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { getApiData } from '../lib/storage.js'
import { listDocuments, processDocument } from '../lib/bigquery.js'

const documents = new Hono()

documents.use('*', requireAuth)

documents.get('/', async (c) => {
  try {
    const data = await getApiData('documents.json')
    return c.json(JSON.parse(data))
  } catch {
    const docs = await listDocuments()
    return c.json({ documents: docs })
  }
})

documents.post('/process', async (c) => {
  const body = await c.req.json<{ uri: string }>()
  const { uri } = body

  if (!uri) {
    return c.json({ error: 'uri is required' }, 400)
  }

  const result = await processDocument(uri)

  if (result.success) {
    return c.json({ success: true, jobId: result.jobId })
  } else {
    return c.json({ error: result.error }, 500)
  }
})

documents.get('/:id/text', async (c) => {
  const id = c.req.param('id')

  try {
    const data = await getApiData(`documents/${id}/text.json`)
    return c.json(JSON.parse(data))
  } catch {
    return c.json({ error: 'Document text not found' }, 404)
  }
})

export default documents
