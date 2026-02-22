import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { ChatSource } from '../../types/chat.js'

// searchChunks モック設定
const mockSearchChunks = jest.fn<(...args: unknown[]) => Promise<ChatSource[]>>()
jest.unstable_mockModule('../../lib/chat-search.js', () => ({
  searchChunks: mockSearchChunks,
  extractKeywords: jest.fn(),
  formatSearchResponse: jest.fn(),
}))

describe('keywordSearchTool', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call searchChunks with keywords', async () => {
    const mockResults: ChatSource[] = [
      { document_id: 'doc1', title: 'たんぽぽ通信.pdf', chunk_text: '給食の時間は12時です', chunk_index: 2 },
    ]
    mockSearchChunks.mockResolvedValue(mockResults)

    const { keywordSearchTool } = await import('./keyword-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await keywordSearchTool.execute!({ keywords: ['給食'] }, {} as never)

    expect(mockSearchChunks).toHaveBeenCalledWith(['給食'])
    expect(result).toEqual({ results: mockResults })
  })

  it('should return results in { results: [...] } format', async () => {
    const mockResults: ChatSource[] = [
      { document_id: 'doc1', title: '行事予定.pdf', chunk_text: '運動会は10月です', chunk_index: 0 },
      { document_id: 'doc2', title: 'たんぽぽ通信.pdf', chunk_text: '運動会の持ち物', chunk_index: 1 },
    ]
    mockSearchChunks.mockResolvedValue(mockResults)

    const { keywordSearchTool } = await import('./keyword-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = (await keywordSearchTool.execute!({ keywords: ['運動会'] }, {} as never)) as {
      results: ChatSource[]
    }

    expect(result).toEqual({ results: mockResults })
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.results).toHaveLength(2)
  })

  it('should return empty results when searchChunks returns empty array', async () => {
    mockSearchChunks.mockResolvedValue([])

    const { keywordSearchTool } = await import('./keyword-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await keywordSearchTool.execute!({ keywords: ['存在しない'] }, {} as never)

    expect(result).toEqual({ results: [] })
  })

  it('should pass multiple keywords to searchChunks', async () => {
    mockSearchChunks.mockResolvedValue([])

    const { keywordSearchTool } = await import('./keyword-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await keywordSearchTool.execute!({ keywords: ['給食', '献立', 'アレルギー'] }, {} as never)

    expect(mockSearchChunks).toHaveBeenCalledWith(['給食', '献立', 'アレルギー'])
  })

  it('should propagate errors from searchChunks', async () => {
    mockSearchChunks.mockRejectedValue(new Error('BigQuery error'))

    const { keywordSearchTool } = await import('./keyword-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(keywordSearchTool.execute!({ keywords: ['給食'] }, {} as never)).rejects.toThrow('BigQuery error')
  })
})
