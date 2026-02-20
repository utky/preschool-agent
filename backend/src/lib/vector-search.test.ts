import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { VectorSearchResult } from '../types/vector-search.js'

// BigQuery モック設定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQuery = jest.fn<(...args: any[]) => any>()
jest.unstable_mockModule('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn(() => ({
    query: mockQuery,
  })),
}))

describe('executeVectorSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BIGQUERY_DATASET_ID = 'test_dataset'
    process.env.GCP_PROJECT_ID = 'test-project'
  })

  it('should call BigQuery VECTOR_SEARCH with correct parameters', async () => {
    const mockRows: VectorSearchResult[] = [
      {
        chunk_id: 'chunk1',
        document_id: 'doc1',
        title: '給食だより.pdf',
        chunk_text: '今月の給食メニュー',
        chunk_index: 0,
        distance: 0.15,
      },
    ]
    mockQuery.mockResolvedValue([mockRows])

    const { executeVectorSearch } = await import('./vector-search.js')
    const result = await executeVectorSearch({ query: '給食のメニュー', topK: 5 })

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, unknown> }
    expect(callArgs.params.query_text).toBe('給食のメニュー')
    expect(callArgs.params.top_k).toBe(5)
    expect(callArgs.query).toContain('VECTOR_SEARCH')
    expect(callArgs.query).toContain('ML.GENERATE_EMBEDDING')
    expect(callArgs.query).toContain('RETRIEVAL_QUERY')
    expect(result).toEqual(mockRows)
  })

  it('should use default topK of 5', async () => {
    mockQuery.mockResolvedValue([[]])

    const { executeVectorSearch } = await import('./vector-search.js')
    await executeVectorSearch({ query: 'テスト' })

    const callArgs = mockQuery.mock.calls[0]![0] as { query: string; params: Record<string, unknown> }
    expect(callArgs.params.top_k).toBe(5)
  })

  it('should return empty array when no results', async () => {
    mockQuery.mockResolvedValue([[]])

    const { executeVectorSearch } = await import('./vector-search.js')
    const result = await executeVectorSearch({ query: '存在しないコンテンツ' })

    expect(result).toEqual([])
  })

  it('should propagate BigQuery errors', async () => {
    mockQuery.mockRejectedValue(new Error('BigQuery error'))

    const { executeVectorSearch } = await import('./vector-search.js')
    await expect(executeVectorSearch({ query: 'テスト' })).rejects.toThrow('BigQuery error')
  })
})
