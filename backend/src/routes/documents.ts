import { Hono } from 'hono'
import { Storage } from '@google-cloud/storage'
import { requireAuth } from '../middleware/auth.js'
import { getApiData, getApiDataFiles, parseNdJson } from '../lib/storage.js'
import type { DocumentMetadata, DocumentChunk } from '../types/documents.js'

const documents = new Hono()

documents.use('*', requireAuth)

documents.get('/', async (c) => {
  const data = await getApiDataFiles('documents_', 'documents.json')
  const documents = parseNdJson<DocumentMetadata>(data)
  return c.json({ documents })
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
    // documents_*.json (NDJSON) からドキュメントを検索
    const docData = await getApiDataFiles('documents_', 'documents.json')
    const docs = parseNdJson<DocumentMetadata>(docData)
    const document = docs.find((d) => d.document_id === id)

    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }

    // GCS V4署名URL生成（1時間有効）
    const match = document.uri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    let signed_url: string | undefined
    if (match) {
      const [, bucket, file] = match
      const [url] = await new Storage().bucket(bucket).file(file).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      })
      signed_url = url
    }

    // chunks_*.json (NDJSON) からchunksを取得
    const chunksData = await getApiDataFiles('chunks_', 'chunks.json')
    const allChunks = parseNdJson<DocumentChunk>(chunksData)
    const chunks = allChunks
      .filter((chunk) => chunk.document_id === id)
      .sort((a, b) => a.chunk_index - b.chunk_index)

    return c.json({ document: { ...document, signed_url }, chunks })
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
