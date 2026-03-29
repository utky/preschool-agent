import { jest, describe, it, expect, afterEach } from '@jest/globals'
import { isAlreadyUploaded, downloadPdf, uploadToGcs, buildOriginalFilename } from '../src/gcs.js'
import type { MediaFile } from '../src/types.js'

// @google-cloud/storage のモック
const mockExists = jest.fn<() => Promise<[boolean]>>()
const mockSave = jest.fn<() => Promise<void>>()
const mockFile = jest.fn(() => ({ exists: mockExists, save: mockSave }))
const mockBucket = jest.fn(() => ({ file: mockFile }))
const mockStorage = { bucket: mockBucket } as unknown as import('@google-cloud/storage').Storage

describe('gcs', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('isAlreadyUploaded', () => {
    it('should return true when file exists', async () => {
      mockExists.mockResolvedValue([true])

      const result = await isAlreadyUploaded(mockStorage, 'my-bucket', 'web/2026/03/test.pdf')

      expect(result).toBe(true)
      expect(mockBucket).toHaveBeenCalledWith('my-bucket')
      expect(mockFile).toHaveBeenCalledWith('web/2026/03/test.pdf')
    })

    it('should return false when file does not exist', async () => {
      mockExists.mockResolvedValue([false])

      const result = await isAlreadyUploaded(mockStorage, 'my-bucket', 'web/2026/03/test.pdf')

      expect(result).toBe(false)
    })
  })

  describe('uploadToGcs', () => {
    it('should upload with correct metadata', async () => {
      mockSave.mockResolvedValue(undefined)

      const media: MediaFile = {
        id: 2840,
        date: '2026-03-15T10:00:00Z',
        modified: '2026-03-15T10:00:00Z',
        title: { rendered: '2026年度バレエ教室プリエ募集' },
        mime_type: 'application/pdf',
        source_url: 'https://tatibana.ed.jp/youtien/wp-content/uploads/2026/03/2026%E5%B9%B4%E5%BA%A6%E3%80%80%E3%83%90%E3%83%AC%E3%82%A8%E6%95%99%E5%AE%A4.pdf',
        post: 100,
      }

      const content = Buffer.from('dummy pdf content')
      await uploadToGcs(mockStorage, 'my-bucket', 'web/2026/03/2840_test.pdf', content, media)

      expect(mockSave).toHaveBeenCalledTimes(1)
      // @google-cloud/storage v7: カスタムメタデータは metadata.metadata に格納
      const [savedContent, savedOptions] = mockSave.mock.calls[0] as unknown as [
        Buffer,
        { metadata: { contentType: string; metadata: Record<string, string> } },
      ]
      expect(savedContent).toEqual(content)
      expect(savedOptions.metadata.contentType).toBe('application/pdf')
      expect(savedOptions.metadata.metadata['letter-id']).toBe('100')
      expect(savedOptions.metadata.metadata['media-id']).toBe('2840')
      expect(savedOptions.metadata.metadata['source-url']).toBe(media.source_url)
      // original-filename はURLエンコードされた日本語ファイル名であること
      expect(savedOptions.metadata.metadata['original-filename']).toBeTruthy()
    })
  })

  describe('buildOriginalFilename', () => {
    it('should encode filename from source_url', () => {
      const sourceUrl = 'https://tatibana.ed.jp/youtien/wp-content/uploads/2026/03/2026年度バレエ.pdf'
      const result = buildOriginalFilename(sourceUrl)
      // URLエンコードされていること
      expect(result).toBe(encodeURIComponent('2026年度バレエ.pdf'))
    })

    it('should handle already percent-encoded URLs', () => {
      // source_url がすでにパーセントエンコードされている場合
      const sourceUrl = 'https://tatibana.ed.jp/youtien/wp-content/uploads/2026/03/2026%E5%B9%B4%E5%BA%A6.pdf'
      const result = buildOriginalFilename(sourceUrl)
      // デコード→エンコードして返す
      expect(result).toBe(encodeURIComponent('2026年度.pdf'))
    })

    it('should handle ASCII filenames', () => {
      const sourceUrl = 'https://example.com/files/document.pdf'
      const result = buildOriginalFilename(sourceUrl)
      expect(result).toBe('document.pdf')
    })
  })

  describe('downloadPdf', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return buffer from successful response', async () => {
      const dummyContent = Buffer.from('PDF content')
      const mockArrayBuffer = async () => dummyContent.buffer

      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: mockArrayBuffer,
      } as unknown as Response)

      const result = await downloadPdf('https://example.com/test.pdf', 'https://example.com/')

      expect(Buffer.isBuffer(result)).toBe(true)
      // Refererヘッダーが付与されること
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect((options.headers as Record<string, string>)['Referer']).toBe('https://example.com/')
    })

    it('should return buffer for URL with Japanese characters', async () => {
      const dummyContent = Buffer.from('PDF content')
      const mockArrayBuffer = async () => dummyContent.buffer

      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: mockArrayBuffer,
      } as unknown as Response)

      await downloadPdf('https://example.com/2026年度資料.pdf', 'https://example.com/')

      // URLがエンコードされていること
      const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(calledUrl).toBe('https://example.com/2026%E5%B9%B4%E5%BA%A6%E8%B3%87%E6%96%99.pdf')
    })

    it('should throw error on failed response', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

      await expect(downloadPdf('https://example.com/protected.pdf', 'https://example.com/')).rejects.toThrow(
        'PDF ダウンロード失敗'
      )
    })
  })
})
