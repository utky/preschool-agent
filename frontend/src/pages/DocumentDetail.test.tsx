import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DocumentDetail from './DocumentDetail'
import { apiGet } from '@/lib/api'

const mockDocumentDetailResponse = {
  document: {
    document_id: 'abc123',
    uri: 'gs://bucket/sample.pdf',
    title: 'sample.pdf',
    document_type: null,
    publish_date: null,
    content_type: 'application/pdf',
    size: 12345,
    total_chunks: 2,
    updated_at: '2025-01-15T10:30:00Z',
  },
  chunks: [
    {
      chunk_id: 'chunk1',
      document_id: 'abc123',
      chunk_index: 0,
      chunk_text: 'チャンク1のテキスト。',
      title: 'sample.pdf',
      document_type: null,
      publish_date: null,
    },
    {
      chunk_id: 'chunk2',
      document_id: 'abc123',
      chunk_index: 1,
      chunk_text: 'チャンク2のテキスト。',
      title: 'sample.pdf',
      document_type: null,
      publish_date: null,
    },
  ],
}

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}))

const renderWithRouter = (documentId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/documents/${documentId}`]}>
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DocumentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render document title and chunks after loading', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockDocumentDetailResponse)

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(screen.getByText('sample.pdf')).toBeInTheDocument()
    })

    expect(screen.getByText('チャンク1のテキスト。')).toBeInTheDocument()
    expect(screen.getByText('チャンク2のテキスト。')).toBeInTheDocument()
  })

  it('should show loading spinner initially', () => {
    vi.mocked(apiGet).mockReturnValue(new Promise(() => {}))

    renderWithRouter('abc123')

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should call API with correct document ID', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockDocumentDetailResponse)

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/documents/abc123')
    })
  })

  it('should display document type and publish date when available', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      ...mockDocumentDetailResponse,
      document: {
        ...mockDocumentDetailResponse.document,
        document_type: '通知',
        publish_date: '2025-01-15',
      },
    })

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(screen.getByText('通知')).toBeInTheDocument()
      expect(screen.getByText('2025-01-15')).toBeInTheDocument()
    })
  })

  it('should format file size as KB', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      ...mockDocumentDetailResponse,
      document: { ...mockDocumentDetailResponse.document, size: 1536 },
    })

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    })
  })

  it('should show error message when API fails', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('Not found'))

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(screen.getByText('Failed to load document')).toBeInTheDocument()
    })
  })

  it('should have a back link to documents list', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockDocumentDetailResponse)

    renderWithRouter('abc123')

    await waitFor(() => {
      expect(screen.getByText('sample.pdf')).toBeInTheDocument()
    })

    const backLink = screen.getByRole('link', { name: /Back to documents/ })
    expect(backLink).toHaveAttribute('href', '/documents')
  })
})
