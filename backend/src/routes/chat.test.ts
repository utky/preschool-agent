import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// chatAgent モック設定
const mockGenerate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.unstable_mockModule('../agents/chat-agent.js', () => ({
  chatAgent: {
    generate: mockGenerate,
  },
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

  it('should return agent response with sources for valid message', async () => {
    const toolResults = [
      {
        toolName: 'vectorSearch',
        result: {
          results: [
            {
              chunk_id: 'chunk1',
              document_id: 'doc1',
              title: '給食だより.pdf',
              chunk_text: '今月の給食メニュー',
              chunk_index: 0,
              distance: 0.15,
            },
          ],
        },
      },
    ]
    mockGenerate.mockResolvedValue({
      text: '今月の給食メニューは以下の通りです。',
      toolResults,
    })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '給食のメニューを教えて' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.response).toBe('今月の給食メニューは以下の通りです。')
    expect(body.sources).toEqual([
      {
        document_id: 'doc1',
        title: '給食だより.pdf',
        chunk_text: '今月の給食メニュー',
        chunk_index: 0,
      },
    ])
    expect(mockGenerate).toHaveBeenCalledWith('給食のメニューを教えて')
  })

  it('should return empty sources when agent does not use tools', async () => {
    mockGenerate.mockResolvedValue({
      text: 'お手伝いできることがあればお聞きください。',
      toolResults: [],
    })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'こんにちは' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.response).toBe('お手伝いできることがあればお聞きください。')
    expect(body.sources).toEqual([])
  })

  it('should ignore non-search tool results', async () => {
    mockGenerate.mockResolvedValue({
      text: '応答テキスト',
      toolResults: [
        {
          toolName: 'someOtherTool',
          result: { data: 'something' },
        },
      ],
    })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'テスト' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.sources).toEqual([])
  })

  it('should include titleSearch results in sources', async () => {
    const toolResults = [
      {
        toolName: 'titleSearch',
        result: {
          results: [
            {
              document_id: 'doc2',
              title: 'R8-2月給食献立表.pdf',
              chunk_text: '2月の献立',
              chunk_index: 0,
            },
          ],
        },
      },
    ]
    mockGenerate.mockResolvedValue({ text: '給食の献立はこちらです。', toolResults })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '給食の献立を教えて' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.sources).toEqual([
      { document_id: 'doc2', title: 'R8-2月給食献立表.pdf', chunk_text: '2月の献立', chunk_index: 0 },
    ])
  })

  it('should include keywordSearch results in sources', async () => {
    const toolResults = [
      {
        toolName: 'keywordSearch',
        result: {
          results: [
            {
              document_id: 'doc3',
              title: 'たんぽぽ通信.pdf',
              chunk_text: '給食は12時から',
              chunk_index: 1,
            },
          ],
        },
      },
    ]
    mockGenerate.mockResolvedValue({ text: '給食の時間は12時です。', toolResults })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '給食は何時から？' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.sources).toEqual([
      { document_id: 'doc3', title: 'たんぽぽ通信.pdf', chunk_text: '給食は12時から', chunk_index: 1 },
    ])
  })

  it('should deduplicate sources from multiple tools', async () => {
    const toolResults = [
      {
        toolName: 'titleSearch',
        result: {
          results: [
            { document_id: 'doc1', title: '給食献立表.pdf', chunk_text: '1月の献立', chunk_index: 0 },
          ],
        },
      },
      {
        toolName: 'keywordSearch',
        result: {
          results: [
            // 同じ document_id + chunk_index → 重複
            { document_id: 'doc1', title: '給食献立表.pdf', chunk_text: '1月の献立', chunk_index: 0 },
            // 異なる chunk_index → 追加
            { document_id: 'doc1', title: '給食献立表.pdf', chunk_text: '2月の献立', chunk_index: 1 },
          ],
        },
      },
    ]
    mockGenerate.mockResolvedValue({ text: '献立をまとめました。', toolResults })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '献立を教えて' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    // 重複を除いて2件
    expect(body.sources).toHaveLength(2)
    expect(body.sources).toEqual([
      { document_id: 'doc1', title: '給食献立表.pdf', chunk_text: '1月の献立', chunk_index: 0 },
      { document_id: 'doc1', title: '給食献立表.pdf', chunk_text: '2月の献立', chunk_index: 1 },
    ])
  })

  it('should handle undefined toolResults', async () => {
    mockGenerate.mockResolvedValue({
      text: '応答テキスト',
    })

    const { default: chat } = await import('./chat.js')
    const res = await chat.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'テスト' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { response: string; sources: unknown[] }
    expect(body.sources).toEqual([])
  })

  it('should return 500 on internal error', async () => {
    mockGenerate.mockRejectedValue(new Error('LLM error'))

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
