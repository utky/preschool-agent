import { Hono } from 'hono'
import { Storage } from '@google-cloud/storage'
import { requireAuth } from '../middleware/auth.js'
import { getApiData } from '../lib/storage.js'
import { listDocuments } from '../lib/bigquery.js'
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

documents.get('/download', async (c) => {
  const uri = c.req.query('uri')
  if (!uri) {
    return c.json({ error: 'uri parameter is required' }, 400)
  }

  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    return c.json({ error: 'Invalid GCS URI' }, 400)
  }

  const [, bucketName, fileName] = match
  const storage = new Storage()
  const [signedUrl] = await storage
    .bucket(bucketName)
    .file(fileName)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15分
    })

  return c.json({ url: signedUrl })
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
