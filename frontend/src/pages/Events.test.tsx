import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Events from './Events'
import { apiGet } from '@/lib/api'
import type { EventsResponse } from '@/types/events'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

const MOCK_ICAL = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:入園式\nEND:VEVENT\nEND:VCALENDAR'

const mockEventsResponse: EventsResponse = {
  events: [
    {
      event_id: 'abc123',
      document_id: 'doc1',
      document_title: '令和8年度春の行事予定',
      event_date: '2026-04-01',
      event_time: '10:00',
      event_title: '入園式',
      event_description: '春の入園式',
      ical_content: MOCK_ICAL,
    },
    {
      event_id: 'def456',
      document_id: 'doc1',
      document_title: '令和8年度春の行事予定',
      event_date: '2026-05-01',
      event_time: null,
      event_title: '春の遠足',
      event_description: '公園への遠足',
      ical_content: MOCK_ICAL,
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

  it('should display events as cards after loading', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('入園式')).toBeInTheDocument()
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

  it('should display document title as link', async () => {
    vi.mocked(apiGet).mockResolvedValue(mockEventsResponse)

    renderEvents()

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: '令和8年度春の行事予定' })
      expect(links.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should display events sorted by event_date ASC when API returns reverse order', async () => {
    // APIが逆順（新しい日付が先）で返してきた場合でもASCで表示されること
    const reverseOrderResponse: EventsResponse = {
      events: [
        {
          event_id: 'z999',
          document_id: 'doc1',
          document_title: 'テスト',
          event_date: '2026-06-01',
          event_time: null,
          event_title: '遅い行事',
          event_description: '',
          ical_content: MOCK_ICAL,
        },
        {
          event_id: 'a001',
          document_id: 'doc1',
          document_title: 'テスト',
          event_date: '2026-04-01',
          event_time: null,
          event_title: '早い行事',
          event_description: '',
          ical_content: MOCK_ICAL,
        },
      ],
    }
    vi.mocked(apiGet).mockResolvedValue(reverseOrderResponse)

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('早い行事')).toBeInTheDocument()
    })

    const titles = screen.getAllByText(/早い行事|遅い行事/)
    expect(titles[0]).toHaveTextContent('早い行事')
    expect(titles[1]).toHaveTextContent('遅い行事')
  })

  it('should sort events on same date by event_time ASC with null at end', async () => {
    const sameDateResponse: EventsResponse = {
      events: [
        {
          event_id: 'c003',
          document_id: 'doc1',
          document_title: 'テスト',
          event_date: '2026-05-10',
          event_time: null,
          event_title: '時刻なし行事',
          event_description: '',
          ical_content: MOCK_ICAL,
        },
        {
          event_id: 'b002',
          document_id: 'doc1',
          document_title: 'テスト',
          event_date: '2026-05-10',
          event_time: '14:00',
          event_title: '午後の行事',
          event_description: '',
          ical_content: MOCK_ICAL,
        },
        {
          event_id: 'a001',
          document_id: 'doc1',
          document_title: 'テスト',
          event_date: '2026-05-10',
          event_time: '09:00',
          event_title: '午前の行事',
          event_description: '',
          ical_content: MOCK_ICAL,
        },
      ],
    }
    vi.mocked(apiGet).mockResolvedValue(sameDateResponse)

    renderEvents()

    await waitFor(() => {
      expect(screen.getByText('午前の行事')).toBeInTheDocument()
    })

    const titles = screen.getAllByText(/午前の行事|午後の行事|時刻なし行事/)
    expect(titles[0]).toHaveTextContent('午前の行事')
    expect(titles[1]).toHaveTextContent('午後の行事')
    expect(titles[2]).toHaveTextContent('時刻なし行事')
  })
})
