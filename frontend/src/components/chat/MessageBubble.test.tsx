import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from '@/types/chat'

const renderWithRouter = (message: ChatMessage) => {
  return render(
    <MemoryRouter>
      <MessageBubble message={message} />
    </MemoryRouter>
  )
}

describe('MessageBubble', () => {
  it('should render user message with right alignment', () => {
    const message: ChatMessage = { role: 'user', content: 'テスト質問' }
    const { container } = renderWithRouter(message)

    expect(screen.getByText('テスト質問')).toBeInTheDocument()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('justify-end')
  })

  it('should render assistant message with left alignment', () => {
    const message: ChatMessage = { role: 'assistant', content: '回答テスト' }
    const { container } = renderWithRouter(message)

    expect(screen.getByText('回答テスト')).toBeInTheDocument()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('justify-start')
  })

  it('should render source links when sources are provided', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: '検索結果',
      sources: [
        { document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'テキスト', chunk_index: 0 },
        { document_id: 'doc2', title: '献立表.pdf', chunk_text: 'テキスト2', chunk_index: 1 },
      ],
    }
    renderWithRouter(message)

    const link1 = screen.getByRole('link', { name: /給食だより\.pdf/ })
    expect(link1).toHaveAttribute('href', '/documents/doc1')

    const link2 = screen.getByRole('link', { name: /献立表\.pdf/ })
    expect(link2).toHaveAttribute('href', '/documents/doc2')
  })

  it('should not render sources section when no sources', () => {
    const message: ChatMessage = { role: 'assistant', content: '回答' }
    renderWithRouter(message)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('should deduplicate source links by document_id', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: '検索結果',
      sources: [
        { document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'チャンク1', chunk_index: 0 },
        { document_id: 'doc1', title: '給食だより.pdf', chunk_text: 'チャンク2', chunk_index: 1 },
      ],
    }
    renderWithRouter(message)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
  })
})
