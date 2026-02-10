import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChunkList from './ChunkList'
import type { DocumentChunk } from '@/types/documents'

const mockChunks: DocumentChunk[] = [
  {
    chunk_id: 'chunk1',
    document_id: 'doc1',
    chunk_index: 0,
    chunk_text: '第1チャンクのテキスト内容。',
    title: 'sample.pdf',
    document_type: null,
    publish_date: null,
  },
  {
    chunk_id: 'chunk2',
    document_id: 'doc1',
    chunk_index: 1,
    chunk_text: '第2チャンクのテキスト内容。',
    title: 'sample.pdf',
    document_type: null,
    publish_date: null,
  },
]

describe('ChunkList', () => {
  it('should render all chunks with index labels', () => {
    render(<ChunkList chunks={mockChunks} />)

    expect(screen.getByText('Chunk 1')).toBeInTheDocument()
    expect(screen.getByText('Chunk 2')).toBeInTheDocument()
    expect(screen.getByText('第1チャンクのテキスト内容。')).toBeInTheDocument()
    expect(screen.getByText('第2チャンクのテキスト内容。')).toBeInTheDocument()
  })

  it('should render empty state when no chunks', () => {
    render(<ChunkList chunks={[]} />)

    expect(screen.getByText('No chunks available')).toBeInTheDocument()
  })

  it('should display chunk count', () => {
    render(<ChunkList chunks={mockChunks} />)

    expect(screen.getByText('2 chunks')).toBeInTheDocument()
  })

  it('should render single chunk correctly', () => {
    const singleChunk: DocumentChunk[] = [{
      chunk_id: 'chunk1',
      document_id: 'doc1',
      chunk_index: 0,
      chunk_text: '単一チャンク',
      title: 'sample.pdf',
      document_type: null,
      publish_date: null,
    }]

    render(<ChunkList chunks={singleChunk} />)

    expect(screen.getByText('Chunk 1')).toBeInTheDocument()
    expect(screen.getByText('単一チャンク')).toBeInTheDocument()
    expect(screen.getByText('1 chunks')).toBeInTheDocument()
  })
})
