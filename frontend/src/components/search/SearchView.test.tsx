import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SearchView from './SearchView'
import type { SearchResult } from '@/types/chat'

const renderWithRouter = (props: Parameters<typeof SearchView>[0]) => {
  return render(
    <MemoryRouter>
      <SearchView {...props} />
    </MemoryRouter>
  )
}

const mockResult: SearchResult = {
  answer: '給食の情報です。',
  sources: [
    { document_id: 'doc1', title: '給食だより.pdf', chunk_text: '今月のメニュー', chunk_index: 0 },
    { document_id: 'doc2', title: '献立表.pdf', chunk_text: '4月の献立', chunk_index: 0 },
  ],
}

describe('SearchView', () => {
  it('should render search bar', () => {
    renderWithRouter({ result: null, isLoading: false, onSearch: vi.fn() })

    expect(screen.getByPlaceholderText('キーワードまたは質問を入力...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument()
  })

  it('should show hint text when no result', () => {
    renderWithRouter({ result: null, isLoading: false, onSearch: vi.fn() })

    expect(screen.getByText('保育園から配布された文書を検索できます')).toBeInTheDocument()
  })

  it('should call onSearch with trimmed input on submit', () => {
    const onSearch = vi.fn()
    renderWithRouter({ result: null, isLoading: false, onSearch })

    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')
    fireEvent.change(input, { target: { value: '  給食  ' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSearch).toHaveBeenCalledWith('給食')
  })

  it('should not call onSearch when input is empty', () => {
    const onSearch = vi.fn()
    renderWithRouter({ result: null, isLoading: false, onSearch })

    const input = screen.getByPlaceholderText('キーワードまたは質問を入力...')
    fireEvent.submit(input.closest('form')!)

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('should show loading indicator when loading', () => {
    renderWithRouter({ result: null, isLoading: true, onSearch: vi.fn() })

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('should disable input and button while loading', () => {
    renderWithRouter({ result: null, isLoading: true, onSearch: vi.fn() })

    expect(screen.getByPlaceholderText('キーワードまたは質問を入力...')).toBeDisabled()
    expect(screen.getByRole('button', { name: '検索' })).toBeDisabled()
  })

  it('should display error message when error is provided', () => {
    renderWithRouter({ result: null, isLoading: false, onSearch: vi.fn(), error: 'エラーが発生しました' })

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('should render AI answer and source cards when result is provided', () => {
    renderWithRouter({ result: mockResult, isLoading: false, onSearch: vi.fn() })

    expect(screen.getByText('給食の情報です。')).toBeInTheDocument()
    expect(screen.getByText('給食だより.pdf')).toBeInTheDocument()
    expect(screen.getByText('献立表.pdf')).toBeInTheDocument()
  })

  it('should deduplicate sources by document_id', () => {
    const resultWithDupes: SearchResult = {
      answer: '回答',
      sources: [
        { document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'チャンク1', chunk_index: 0 },
        { document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'チャンク2', chunk_index: 1 },
      ],
    }
    renderWithRouter({ result: resultWithDupes, isLoading: false, onSearch: vi.fn() })

    expect(screen.getAllByText('給食だより.pdf')).toHaveLength(1)
  })

  it('should not show hint text when result is present', () => {
    renderWithRouter({ result: mockResult, isLoading: false, onSearch: vi.fn() })

    expect(screen.queryByText('保育園から配布された文書を検索できます')).not.toBeInTheDocument()
  })
})
