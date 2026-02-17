import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { ChatSource } from '../types/chat.js'

// BigQuery モック設定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn(() => ({
    query: mockQuery,
  })),
}))

describe('extractKeywords', () => {
  it('should split message by whitespace', async () => {
    const { extractKeywords } = await import('./chat-search.js')
    expect(extractKeywords('給食 献立')).toEqual(['給食', '献立'])
  })

  it('should remove empty strings', async () => {
    const { extractKeywords } = await import('./chat-search.js')
    expect(extractKeywords('  給食   献立  ')).toEqual(['給食', '献立'])
  })

  it('should return empty array for empty string', async () => {
    const { extractKeywords } = await import('./chat-search.js')
    expect(extractKeywords('')).toEqual([])
  })

  it('should return empty array for whitespace-only string', async () => {
    const { extractKeywords } = await import('./chat-search.js')
    expect(extractKeywords('   ')).toEqual([])
  })

  it('should handle single keyword', async () => {
    const { extractKeywords } = await import('./chat-search.js')
    expect(extractKeywords('給食')).toEqual(['給食'])
  })
})

describe('formatSearchResponse', () => {
  it('should format response with sources', async () => {
    const { formatSearchResponse } = await import('./chat-search.js')
    const sources: ChatSource[] = [
      { document_id: 'doc1', title: '給食だより.pdf', chunk_text: '今月の給食メニュー', chunk_index: 0 },
      { document_id: 'doc2', title: '献立表.pdf', chunk_text: '献立のお知らせ', chunk_index: 1 },
    ]
    const result = formatSearchResponse(['給食'], sources)
    expect(result).toContain('2件')
    expect(result).toContain('給食だより.pdf')
    expect(result).toContain('献立表.pdf')
  })

  it('should return no-results message when sources are empty', async () => {
    const { formatSearchResponse } = await import('./chat-search.js')
    const result = formatSearchResponse(['給食'], [])
    expect(result).toContain('見つかりませんでした')
  })

  it('should include keyword in no-results message', async () => {
    const { formatSearchResponse } = await import('./chat-search.js')
    const result = formatSearchResponse(['給食', '献立'], [])
    expect(result).toContain('給食')
    expect(result).toContain('献立')
  })
})

describe('searchChunks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
  })

  it('should query BigQuery with LIKE parameters', async () => {
    const mockRows: ChatSource[] = [
      { document_id: 'doc1', title: '給食だより.pdf', chunk_text: '今月の給食メニュー', chunk_index: 0 },
    ]
    mockQuery.mockResolvedValue([mockRows])

    const { searchChunks } = await import('./chat-search.js')
    const result = await searchChunks(['給食'])

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, string> }
    expect(callArgs.params).toEqual({ keyword0: '%給食%' })
    expect(callArgs.query).toContain('LIKE @keyword0')
    expect(result).toEqual(mockRows)
  })

  it('should handle multiple keywords with OR', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchChunks } = await import('./chat-search.js')
    await searchChunks(['給食', '献立'])

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, string> }
    expect(callArgs.params).toEqual({ keyword0: '%給食%', keyword1: '%献立%' })
    expect(callArgs.query).toContain('LIKE @keyword0')
    expect(callArgs.query).toContain('LIKE @keyword1')
    expect(callArgs.query).toContain('OR')
  })

  it('should return empty array when no results', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchChunks } = await import('./chat-search.js')
    const result = await searchChunks(['存在しないキーワード'])

    expect(result).toEqual([])
  })

  it('should return empty array for empty keywords', async () => {
    const { searchChunks } = await import('./chat-search.js')
    const result = await searchChunks([])

    expect(result).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
