import { Hono } from 'hono'
import { Storage } from '@google-cloud/storage'
import { requireAuth } from '../middleware/auth.js'
import { getApiData, getApiDataFiles, parseNdJson } from '../lib/storage.js'
import { parseGcsUri, isSignableObject, type GcsObjectRef } from '../lib/access-policy.js'
import type { DocumentMetadata, DocumentChunk } from '../types/documents.js'

const documents = new Hono()

// 署名を許可するバケット（PDF格納バケット）。テスト・設定変更に追従するためリクエスト時に読む
const getAllowedPdfBucket = (): string | undefined => process.env.PDF_BUCKET_NAME

// 許可バケット内のオブジェクトであれば V4 署名付き読み取りURLを発行する。許可外なら null
async function signIfAllowed(ref: GcsObjectRef, ttlMs: number): Promise<string | null> {
  if (!isSignableObject(ref, getAllowedPdfBucket())) return null
  const [url] = await new Storage().bucket(ref.bucket).file(ref.object).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + ttlMs,
  })
  return url
}

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

  const ref = parseGcsUri(uri)
  if (!ref) {
    return c.json({ error: 'Invalid GCS URI' }, 400)
  }

  try {
    const signedUrl = await signIfAllowed(ref, 15 * 60 * 1000) // 15分
    if (signedUrl === null) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    return c.json({ url: signedUrl })
  } catch {
    return c.json({ error: 'File not found or signing failed' }, 404)
  }
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

    // GCS V4署名URL生成（1時間有効）。許可バケット外の場合は付与しない
    const ref = parseGcsUri(document.uri)
    const signed_url = ref ? ((await signIfAllowed(ref, 60 * 60 * 1000)) ?? undefined) : undefined

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
