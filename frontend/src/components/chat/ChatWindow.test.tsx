import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ChatWindow from './ChatWindow'
import type { ChatMessage } from '@/types/chat'

const renderWithRouter = (props: Parameters<typeof ChatWindow>[0]) => {
  return render(
    <MemoryRouter>
      <ChatWindow {...props} />
    </MemoryRouter>
  )
}

describe('ChatWindow', () => {
  it('should render empty state message when no messages', () => {
    renderWithRouter({ messages: [], isLoading: false, onSend: vi.fn() })

    expect(screen.getByText('キーワードを入力して文書を検索できます。')).toBeInTheDocument()
  })

  it('should render messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '給食' },
      { role: 'assistant', content: '結果が見つかりました。' },
    ]
    renderWithRouter({ messages, isLoading: false, onSend: vi.fn() })

    expect(screen.getByText('給食')).toBeInTheDocument()
    expect(screen.getByText('結果が見つかりました。')).toBeInTheDocument()
  })

  it('should call onSend when form is submitted', () => {
    const onSend = vi.fn()
    renderWithRouter({ messages: [], isLoading: false, onSend })

    const input = screen.getByPlaceholderText('キーワードを入力...')
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSend).toHaveBeenCalledWith('給食')
  })

  it('should clear input after sending', () => {
    const onSend = vi.fn()
    renderWithRouter({ messages: [], isLoading: false, onSend })

    const input = screen.getByPlaceholderText('キーワードを入力...') as HTMLInputElement
    fireEvent.change(input, { target: { value: '給食' } })
    fireEvent.submit(input.closest('form')!)

    expect(input.value).toBe('')
  })

  it('should not send empty message', () => {
    const onSend = vi.fn()
    renderWithRouter({ messages: [], isLoading: false, onSend })

    const input = screen.getByPlaceholderText('キーワードを入力...')
    fireEvent.submit(input.closest('form')!)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should disable input and button when loading', () => {
    renderWithRouter({ messages: [], isLoading: true, onSend: vi.fn() })

    const input = screen.getByPlaceholderText('キーワードを入力...')
    const button = screen.getByRole('button', { name: '送信' })

    expect(input).toBeDisabled()
    expect(button).toBeDisabled()
  })

  it('should show loading indicator when loading', () => {
    renderWithRouter({ messages: [], isLoading: true, onSend: vi.fn() })

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('should display error message when error is provided', () => {
    renderWithRouter({ messages: [], isLoading: false, onSend: vi.fn(), error: 'エラーが発生しました' })

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })
})
