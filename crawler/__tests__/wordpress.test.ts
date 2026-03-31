import { jest, describe, it, expect, afterEach } from '@jest/globals'
import { fetchLetters, fetchAttachments, selectLatestAttachment, buildGcsPath, sanitizeFilename } from '../src/wordpress.js'
import type { LetterPost, MediaFile } from '../src/types.js'

describe('wordpress', () => {
  const BASE_URL = 'https://tatibana.ed.jp/youtien'

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('fetchLetters', () => {
    it('should fetch all letters and handle pagination', async () => {
      // 1ページ目: 100件（最大値 → 次ページあり）
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        date: '2026-03-01T00:00:00Z',
        modified: '2026-03-01T00:00:00Z',
        title: { rendered: `Letter ${i + 1}` },
        _links: { 'wp:attachment': [{ href: `${BASE_URL}/wp-json/wp/v2/media?parent=${i + 1}` }] },
      })) as LetterPost[]

      // 2ページ目: 2件（最大値未満 → 最終ページ）
      const page2 = [
        {
          id: 101,
          date: '2026-03-02T00:00:00Z',
          modified: '2026-03-02T00:00:00Z',
          title: { rendered: 'Letter 101' },
          _links: { 'wp:attachment': [{ href: `${BASE_URL}/wp-json/wp/v2/media?parent=101` }] },
        },
      ] as LetterPost[]

      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => page1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => page2,
        } as Response)

      const result = await fetchLetters(BASE_URL, new Date('2026-03-01T00:00:00Z'))

      expect(result).toHaveLength(101)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // 1回目のfetch URLにmodified_afterが含まれること
      const firstCallUrl = fetchMock.mock.calls[0][0] as string
      expect(firstCallUrl).toContain('modified_after=')
      expect(firstCallUrl).toContain('per_page=100')
      expect(firstCallUrl).toContain('page=1')
    })

    it('should return empty array when no letters found', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response)

      const result = await fetchLetters(BASE_URL, new Date('2026-03-01T00:00:00Z'))

      expect(result).toHaveLength(0)
    })

    it('should throw error on 400 status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'bad request' }),
      } as Response)

      await expect(
        fetchLetters(BASE_URL, new Date('2026-03-01'))
      ).rejects.toThrow('WordPress API から 400 エラー')
    })
  })

  describe('fetchAttachments', () => {
    it('should fetch PDF attachments for a letter', async () => {
      const mediaFiles: MediaFile[] = [
        {
          id: 2840,
          date: '2026-03-15T10:00:00Z',
          modified: '2026-03-15T19:00:00',
          modified_gmt: '2026-03-15T10:00:00',
          title: { rendered: '2026年度バレエ教室プリエ募集' },
          mime_type: 'application/pdf',
          source_url: 'https://tatibana.ed.jp/youtien/wp-content/uploads/2026/03/ballet.pdf',
          post: 100,
        },
      ]

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mediaFiles,
      } as Response)

      const result = await fetchAttachments(BASE_URL, 100)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(2840)
      expect(result[0].mime_type).toBe('application/pdf')
    })
  })

  describe('selectLatestAttachment', () => {
    it('should return undefined for empty array', () => {
      expect(selectLatestAttachment([])).toBeUndefined()
    })

    it('should return the only element for single-item array', () => {
      const media: MediaFile = {
        id: 2807,
        date: '2026-03-04T09:46:19Z',
        modified: '2026-03-04T18:46:19',
        modified_gmt: '2026-03-04T09:46:19',
        title: { rendered: 'No.89' },
        mime_type: 'application/pdf',
        source_url: 'https://example.com/No.89.pdf',
        post: 2806,
      }
      expect(selectLatestAttachment([media])).toBe(media)
    })

    it('should return the newest attachment when multiple exist', () => {
      // No.89の旧版（初回アップロード）
      const older: MediaFile = {
        id: 2807,
        date: '2026-03-04T09:46:19Z',
        modified: '2026-03-04T18:46:19',
        modified_gmt: '2026-03-04T09:46:19',
        title: { rendered: 'No.89' },
        mime_type: 'application/pdf',
        source_url: 'https://example.com/No.89.pdf',
        post: 2806,
      }
      // No.89の訂正版（9分後にアップロード）
      const newer: MediaFile = {
        id: 2808,
        date: '2026-03-04T09:55:17Z',
        modified: '2026-03-04T18:55:17',
        modified_gmt: '2026-03-04T09:55:17',
        title: { rendered: 'No.89' },
        mime_type: 'application/pdf',
        source_url: 'https://example.com/No.89-1.pdf',
        post: 2806,
      }

      // 順序に関わらず最新が返ること
      expect(selectLatestAttachment([older, newer])).toBe(newer)
      expect(selectLatestAttachment([newer, older])).toBe(newer)
    })
  })

  describe('buildGcsPath', () => {
    it('should build correct GCS path from media file', () => {
      const media: MediaFile = {
        id: 2840,
        date: '2026-03-15T10:00:00Z',
        modified: '2026-03-15T19:00:00',
        modified_gmt: '2026-03-15T10:00:00',
        title: { rendered: '2026年度バレエ教室プリエ募集' },
        mime_type: 'application/pdf',
        source_url: 'https://tatibana.ed.jp/youtien/wp-content/uploads/2026/03/ballet.pdf',
        post: 100,
      }

      const result = buildGcsPath(media)

      expect(result).toBe('web/2026/03/2840_2026年度バレエ教室プリエ募集.pdf')
    })

    it('should zero-pad single-digit months', () => {
      const media: MediaFile = {
        id: 100,
        date: '2026-05-01T00:00:00Z',
        modified: '2026-05-01T09:00:00',
        modified_gmt: '2026-05-01T00:00:00',
        title: { rendered: 'テスト' },
        mime_type: 'application/pdf',
        source_url: 'https://example.com/test.pdf',
        post: 1,
      }

      expect(buildGcsPath(media)).toBe('web/2026/05/100_テスト.pdf')
    })
  })

  describe('sanitizeFilename', () => {
    it('should preserve Japanese characters', () => {
      expect(sanitizeFilename('2026年度バレエ教室プリエ募集')).toBe('2026年度バレエ教室プリエ募集')
    })

    it('should remove path separator characters', () => {
      expect(sanitizeFilename('test/file')).toBe('testfile')
      expect(sanitizeFilename('test\\file')).toBe('testfile')
    })

    it('should remove illegal filename characters', () => {
      expect(sanitizeFilename('file:name')).toBe('filename')
      expect(sanitizeFilename('file*name')).toBe('filename')
      expect(sanitizeFilename('file?name')).toBe('filename')
      expect(sanitizeFilename('file<name>')).toBe('filename')
      expect(sanitizeFilename('file|name')).toBe('filename')
    })

    it('should decode HTML entities', () => {
      // &amp; → & (除去対象外なので保持される)
      expect(sanitizeFilename('2026年&amp;令和8年')).toBe('2026年&令和8年')
      // &lt; &gt; → < > はデコード後に不正文字として除去される
      expect(sanitizeFilename('&lt;テスト&gt;')).toBe('テスト')
      // &quot; → " はデコード後に不正文字として除去される
      expect(sanitizeFilename('&quot;テスト&quot;')).toBe('テスト')
    })
  })
})
