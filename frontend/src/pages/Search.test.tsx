import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Search from './Search'
import { apiPost } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
}))

const renderSearch = () => {
  return render(
    <MemoryRouter>
      <Search />
    </MemoryRouter>
  )
}

describe('Search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render search page with title', () => {
    renderSearch()

    expect(screen.getByText('文書を調べる')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('キーワードまたは質問を入力...')).toBeInTheDocument()
  })

  it('should search and display result', async () => {
    vi.mocked(apiPost).mockResolvedValue({
      response: '給食の情報が見つかりました。',
      sources: [{ document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'テキスト', chunk_index: 0 }],
    })

    renderSearch()

    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('給食の情報が見つかりました。')).toBeInTheDocument()
    })

    expect(apiPost).toHaveBeenCalledWith('/api/chat', { message: '給食' })
  })

  it('should not send history on subsequent searches', async () => {
    vi.mocked(apiPost)
      .mockResolvedValueOnce({ response: '給食の情報です。', sources: [] })
      .mockResolvedValueOnce({ response: '献立の情報です。', sources: [] })

    renderSearch()
    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')

    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('給食の情報です。')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '献立' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('献立の情報です。')).toBeInTheDocument()
    })

    // 各検索は独立してhistoryなしで送信される
    expect(apiPost).toHaveBeenNthCalledWith(2, '/api/chat', { message: '献立' })
  })

  it('should display error message on API failure', async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error('Network error'))

    renderSearch()

    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('検索に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })
  })

  it('should clear error on next successful search', async () => {
    vi.mocked(apiPost)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ response: '結果が見つかりました。', sources: [] })

    renderSearch()
    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')

    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('検索に失敗しました。もう一度お試しください。')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '献立' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('結果が見つかりました。')).toBeInTheDocument()
    })

    expect(screen.queryByText('検索に失敗しました。もう一度お試しください。')).not.toBeInTheDocument()
  })
})
