import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { ChatSource } from '../types/chat.js'

// chat-search モック設定
const mockExtractKeywords = jest.fn<(message: string) => readonly string[]>()
const mockSearchChunks = jest.fn<(keywords: readonly string[]) => Promise<readonly ChatSource[]>>()
const mockFormatSearchResponse = jest.fn<(keywords: readonly string[], sources: readonly ChatSource[]) => string>()

jest.unstable_mockModule('../lib/chat-search.js', () => ({
  extractKeywords: mockExtractKeywords,
  searchChunks: mockSearchChunks,
  formatSearchResponse: mockFormatSearchResponse,
}))

// auth ミドルウェアをバイパス
jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: jest.fn((_c: unknown, next: () => Promise<void>) => next()),
}))

describe('POST /api/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 when message is empty', async () => {
    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Message is required' })
  })

  it('should return 400 when message is whitespace only', async () => {
    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Message is required' })
  })

  it('should return 400 when message is missing', async () => {
    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('should return search results for valid message', async () => {
    const sources: ChatSource[] = [
      { document_id: 'doc1', title: '給食だより.pdf', chunk_text: '今月の給食', chunk_index: 0 },
    ]
    mockExtractKeywords.mockReturnValue(['給食'])
    mockSearchChunks.mockResolvedValue(sources)
    mockFormatSearchResponse.mockReturnValue('1件のチャンクが見つかりました。')

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '給食' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      response: '1件のチャンクが見つかりました。',
      sources,
    })
    expect(mockExtractKeywords).toHaveBeenCalledWith('給食')
    expect(mockSearchChunks).toHaveBeenCalledWith(['給食'])
  })

  it('should return 500 on internal error', async () => {
    mockExtractKeywords.mockReturnValue(['給食'])
    mockSearchChunks.mockRejectedValue(new Error('BigQuery error'))

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '給食' }),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Internal server error' })
  })
})
