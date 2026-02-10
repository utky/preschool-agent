import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { getApiData } from '../lib/storage.js'
import { listDocuments } from '../lib/bigquery.js'
import { triggerDbtJob } from '../lib/cloud-run-job.js'
import type { DocumentMetadata, DocumentChunk } from '../types/documents.js'

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
  const result = await triggerDbtJob()

  if (result.success) {
    return c.json({ success: true, executionId: result.executionId })
  } else {
    return c.json({ error: result.error }, 500)
  }
})

documents.get('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const docData = await getApiData('documents.json')
    const { documents: docs } = JSON.parse(docData) as { documents: DocumentMetadata[] }
    const document = docs.find((d) => d.document_id === id)

    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }

    const chunksData = await getApiData('chunks.json')
    const { chunks: allChunks } = JSON.parse(chunksData) as { chunks: DocumentChunk[] }
    const chunks = allChunks
      .filter((chunk) => chunk.document_id === id)
      .sort((a, b) => a.chunk_index - b.chunk_index)

    return c.json({ document, chunks })
  } catch {
    return c.json({ error: 'Document not found' }, 404)
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
