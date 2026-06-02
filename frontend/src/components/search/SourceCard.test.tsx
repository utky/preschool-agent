import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SourceCard from './SourceCard'
import type { ChatSource } from '@/types/chat'

const source: ChatSource = {
  document_id: 'doc1',
  title: '給食だより.pdf',
  chunk_text: '今月の給食メニューは以下の通りです。',
  chunk_index: 0,
}

describe('SourceCard', () => {
  it('should render title and snippet', () => {
    render(
      <MemoryRouter>
        <SourceCard source={source} />
      </MemoryRouter>
    )

    expect(screen.getByText('給食だより.pdf')).toBeInTheDocument()
    expect(screen.getByText('今月の給食メニューは以下の通りです。')).toBeInTheDocument()
  })

  it('should link to document detail page', () => {
    render(
      <MemoryRouter>
        <SourceCard source={source} />
      </MemoryRouter>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/documents/doc1')
  })
})
