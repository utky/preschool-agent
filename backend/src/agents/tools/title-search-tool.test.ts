import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { ChatSource } from '../../types/chat.js'

// searchByTitle モック設定
const mockSearchByTitle = jest.fn<(...args: unknown[]) => Promise<ChatSource[]>>()
jest.unstable_mockModule('../../lib/title-search.js', () => ({
  searchByTitle: mockSearchByTitle,
}))

describe('titleSearchTool', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call searchByTitle with keywords and limit', async () => {
    const mockResults: ChatSource[] = [
      { document_id: 'doc1', title: 'R8-2月給食献立表.pdf', chunk_text: '献立の内容', chunk_index: 0 },
    ]
    mockSearchByTitle.mockResolvedValue(mockResults)

    const { titleSearchTool } = await import('./title-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await titleSearchTool.execute!({ keywords: ['給食'], limit: 10 }, {} as never)

    expect(mockSearchByTitle).toHaveBeenCalledWith(['給食'], 10)
    expect(result).toEqual({ results: mockResults })
  })

  it('should return results in { results: [...] } format', async () => {
    const mockResults: ChatSource[] = [
      { document_id: 'doc1', title: '4月のお知らせ.pdf', chunk_text: '入園式のお知らせ', chunk_index: 0 },
      { document_id: 'doc1', title: '4月のお知らせ.pdf', chunk_text: '持ち物について', chunk_index: 1 },
    ]
    mockSearchByTitle.mockResolvedValue(mockResults)

    const { titleSearchTool } = await import('./title-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = (await titleSearchTool.execute!({ keywords: ['お知らせ'], limit: 10 }, {} as never)) as {
      results: ChatSource[]
    }

    expect(result).toEqual({ results: mockResults })
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.results).toHaveLength(2)
  })

  it('should return empty results when searchByTitle returns empty array', async () => {
    mockSearchByTitle.mockResolvedValue([])

    const { titleSearchTool } = await import('./title-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await titleSearchTool.execute!({ keywords: ['存在しない'], limit: 10 }, {} as never)

    expect(result).toEqual({ results: [] })
  })

  it('should pass multiple keywords to searchByTitle', async () => {
    mockSearchByTitle.mockResolvedValue([])

    const { titleSearchTool } = await import('./title-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await titleSearchTool.execute!({ keywords: ['給食', '献立'], limit: 5 }, {} as never)

    expect(mockSearchByTitle).toHaveBeenCalledWith(['給食', '献立'], 5)
  })

  it('should propagate errors from searchByTitle', async () => {
    mockSearchByTitle.mockRejectedValue(new Error('BigQuery error'))

    const { titleSearchTool } = await import('./title-search-tool.js')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(titleSearchTool.execute!({ keywords: ['給食'], limit: 10 }, {} as never)).rejects.toThrow(
      'BigQuery error'
    )
  })
})
