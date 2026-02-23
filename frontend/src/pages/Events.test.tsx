import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Events from './Events'
import { apiGet, apiPost } from '@/lib/api'
import type { EventsResponse, CalendarSyncResult } from '@/types/events'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

const mockEventsResponse: EventsResponse = {
  events: [
    {
      event_id: 'abc123',
      document_id: 'doc1',
      event_date: '2026-04-01',
      event_type: '入園式',
      event_title: '入園式',
      event_description: '春の入園式',
      extracted_at: '2026-02-01T00:00:00Z',
      is_synced: true,
      calendar_event_id: 'gcal_001',
      synced_at: '2026-02-10T10:00:00Z',
    },
    {
      event_id: 'def456',
      document_id: 'doc1',
      event_date: '2026-05-01',
      event_type: '遠足',
      event_title: '春の遠足',
      event_description: '公園への遠足',
      extracted_at: '2026-02-01T00:00:00Z',
      is_synced: false,
      calendar_event_id: null,
      synced_at: null,
    },
  ],
}

const renderEvents = () => {
  return render(
    <MemoryRouter>
      <Events />
    </MemoryRouter>
  )
}

describe('Events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page title', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('Events')).toBeInTheDocument()
    })
  })

  it('should show loading spinner initially', () => {
    vi.mocked(apiGet).mockReturnValue(new Promise(() => {}))

    renderEvents()

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should display event cards after loading', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)

    renderEvents()

    await waitFor(() => {
      // event_type と event_title が同じ「入園式」のため getAllByText を使用
      expect(screen.getAllByText('入園式').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('春の遠足')).toBeInTheDocument()
    })
    expect(apiGet).toHaveBeenCalledWith('/api/calendar/events')
  })

  it('should show empty state when no events', async () => {
    vi.mocked(apiGet).mockResolvedValue({ events: [] })

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('イベントはありません')).toBeInTheDocument()
    })
  })

  it('should show error message on API failure', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('Network error'))

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('Failed to load events')).toBeInTheDocument()
    })
  })

  it('should trigger sync and show result on sync button click', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)
    const syncResult: CalendarSyncResult = { synced: 1, skipped: 0, failed: 0, errors: [] }
    vi.mocked(apiPost).mockResolvedValue(syncResult)

    renderEvents()

    await waitFor(() => {
      expect(screen.getAllByText('入園式').length).toBeGreaterThanOrEqual(1)
    })

    const syncButton = screen.getByRole('button', { name: /今すぐ同期/ })
    fireEvent.click(syncButton)

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/calendar/sync')
    })
  })

  it('should display synced badge on synced events', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('登録済み')).toBeInTheDocument()
    })
  })
})
