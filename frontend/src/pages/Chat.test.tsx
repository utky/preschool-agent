import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Chat from './Chat'
import { apiPost } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
}))

const renderChat = () => {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  )
}

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render chat page with title', () => {
    renderChat()

    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('キーワードを入力...')).toBeInTheDocument()
  })

  it('should send message and display response', async () => {
    vi.mocked(apiPost).mockResolvedValue({
      response: '1件のチャンクが見つかりました。',
      sources: [{ document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'テキスト', chunk_index: 0 }],
    })

    renderChat()

    const input = screen.getByPlaceholderText('キーワードを入力...')
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    // ユーザーメッセージが表示される
    expect(screen.getByText('給食')).toBeInTheDocument()

    // APIレスポンスが表示される
    await waitFor(() => {
      expect(screen.getByText('1件のチャンクが見つかりました。')).toBeInTheDocument()
    })

    expect(apiPost).toHaveBeenCalledWith('/api/chat', { message: '給食' })
  })

  it('should display error message on API failure', async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error('Network error'))

    renderChat()

    const input = screen.getByPlaceholderText('キーワードを入力...')
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('検索に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })
  })

  it('should clear error on next successful send', async () => {
    vi.mocked(apiPost)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        response: '結果が見つかりました。',
        sources: [],
      })

    renderChat()
    const input = screen.getByPlaceholderText('キーワードを入力...')

    // 最初の送信 - エラー
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('検索に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })

    // 2回目の送信 - 成功
    fireEvent.change(input, { target: { value: '献立' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('結果が見つかりました。')).toBeInTheDocument()
    })

    expect(screen.queryByText('検索に失敗しました。もう一度お試しください。')).not.toBeInTheDocument()
  })
})
