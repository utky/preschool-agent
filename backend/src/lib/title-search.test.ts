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

describe('searchByTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
  })

  it('should return empty array for empty keywords', async () => {
    const { searchByTitle } = await import('./title-search.js')
    const result = await searchByTitle([])

    expect(result).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('should query BigQuery with LIKE on title column', async () => {
    const mockRows: ChatSource[] = [
      { document_id: 'doc1', title: 'R8-2月給食献立表.pdf', chunk_text: '献立の内容', chunk_index: 0 },
    ]
    mockQuery.mockResolvedValue([mockRows])

    const { searchByTitle } = await import('./title-search.js')
    const result = await searchByTitle(['給食'])

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, string> }
    expect(callArgs.query).toContain('title LIKE @keyword0')
    expect(callArgs.params).toEqual({ keyword0: '%給食%' })
    expect(result).toEqual(mockRows)
  })

  it('should handle multiple keywords with OR', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchByTitle } = await import('./title-search.js')
    await searchByTitle(['給食', '献立'])

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, string> }
    expect(callArgs.query).toContain('title LIKE @keyword0')
    expect(callArgs.query).toContain('title LIKE @keyword1')
    expect(callArgs.query).toContain('OR')
    expect(callArgs.params).toEqual({ keyword0: '%給食%', keyword1: '%献立%' })
  })

  it('should join with fct_document_chunks to return chunk data', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchByTitle } = await import('./title-search.js')
    await searchByTitle(['給食'])

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string }
    expect(callArgs.query).toContain('fct_document_chunks')
    expect(callArgs.query).toContain('dim_documents')
    expect(callArgs.query).toContain('chunk_text')
  })

  it('should respect limit parameter', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchByTitle } = await import('./title-search.js')
    await searchByTitle(['給食'], 3)

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string }
    expect(callArgs.query).toContain('LIMIT 3')
  })

  it('should use default limit of 10', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchByTitle } = await import('./title-search.js')
    await searchByTitle(['給食'])

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string }
    expect(callArgs.query).toContain('LIMIT 10')
  })

  it('should return empty array when no results', async () => {
    mockQuery.mockResolvedValue([[]])

    const { searchByTitle } = await import('./title-search.js')
    const result = await searchByTitle(['存在しないキーワード'])

    expect(result).toEqual([])
  })

  it('should propagate BigQuery errors', async () => {
    mockQuery.mockRejectedValue(new Error('BigQuery error'))

    const { searchByTitle } = await import('./title-search.js')
    await expect(searchByTitle(['給食'])).rejects.toThrow('BigQuery error')
  })
})
