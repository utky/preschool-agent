import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals'

// @google-cloud/storage モック（署名処理と、どのバケット/オブジェクトが署名されたかを記録する）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSignedUrl = jest.fn<(...args: any[]) => any>()
const mockBucket = jest.fn((bucketName: string) => ({
  file: (fileName: string) => ({
    getSignedUrl: (opts: unknown) => mockGetSignedUrl(bucketName, fileName, opts),
  }),
}))
jest.unstable_mockModule('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({ bucket: mockBucket })),
}))

// storage lib モック（documents_*.json / chunks_*.json の読み込み）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetApiDataFiles = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('../lib/storage.js', () => ({
  getApiData: jest.fn(),
  getApiDataFiles: mockGetApiDataFiles,
  parseNdJson: (data: string) =>
    data
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l)),
}))

// auth middleware モック（認証をスキップ）
jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: jest.fn((_c: unknown, next: () => Promise<void>) => next()),
}))

const PDF_BUCKET = 'school-agent-lofilab-pdf-uploads'
const ORIGINAL_ENV = process.env.PDF_BUCKET_NAME

const { default: documentsRoute } = await import('./documents.js')

const download = (uri?: string) =>
  documentsRoute.fetch(
    new Request(`http://localhost/download${uri === undefined ? '' : `?uri=${encodeURIComponent(uri)}`}`),
  )

describe('documents route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PDF_BUCKET_NAME = PDF_BUCKET
    mockGetSignedUrl.mockResolvedValue(['https://signed.example/url'])
  })

  afterAll(() => {
    // process.env への undefined 代入は文字列 'undefined' になるため delete で復元する
    if (ORIGINAL_ENV === undefined) delete process.env.PDF_BUCKET_NAME
    else process.env.PDF_BUCKET_NAME = ORIGINAL_ENV
  })

  describe('GET /download', () => {
    it('should return a signed URL for an object in the PDF bucket', async () => {
      const res = await download(`gs://${PDF_BUCKET}/2026/file.pdf`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ url: 'https://signed.example/url' })
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        PDF_BUCKET,
        '2026/file.pdf',
        expect.objectContaining({ version: 'v4', action: 'read' }),
      )
    })

    it('should return 400 when uri is missing', async () => {
      const res = await download()

      expect(res.status).toBe(400)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('should return 400 when uri is not a gs:// URI', async () => {
      const res = await download('https://example.com/file.pdf')

      expect(res.status).toBe(400)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('should return 403 without signing when the bucket is not the PDF bucket', async () => {
      const res = await download('gs://school-agent-lofilab-api-data/documents_000000000000.json')

      expect(res.status).toBe(403)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('should return 403 without signing when PDF_BUCKET_NAME is not configured', async () => {
      delete process.env.PDF_BUCKET_NAME

      const res = await download(`gs://${PDF_BUCKET}/2026/file.pdf`)

      expect(res.status).toBe(403)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('should return 404 when signing fails', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('signBlob denied'))

      const res = await download(`gs://${PDF_BUCKET}/2026/file.pdf`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /:id', () => {
    const doc = (uri: string) =>
      JSON.stringify({ document_id: 'doc1', uri, title: 'お知らせ' })

    const mockDocument = (uri: string) => {
      mockGetApiDataFiles.mockImplementation(async (prefix: string) =>
        prefix === 'documents_' ? doc(uri) : '',
      )
    }

    it('should attach signed_url when the document is in the PDF bucket', async () => {
      mockDocument(`gs://${PDF_BUCKET}/2026/file.pdf`)

      const res = await documentsRoute.fetch(new Request('http://localhost/doc1'))
      const body = (await res.json()) as { document: { signed_url?: string } }

      expect(res.status).toBe(200)
      expect(body.document.signed_url).toBe('https://signed.example/url')
    })

    it('should omit signed_url without signing when the document is in another bucket', async () => {
      mockDocument('gs://other-bucket/secret.pdf')

      const res = await documentsRoute.fetch(new Request('http://localhost/doc1'))
      const body = (await res.json()) as { document: { signed_url?: string } }

      expect(res.status).toBe(200)
      expect(body.document.signed_url).toBeUndefined()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })
  })
})
