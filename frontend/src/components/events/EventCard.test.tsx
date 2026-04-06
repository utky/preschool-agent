import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import EventCard from './EventCard'
import type { CalendarEvent } from '@/types/events'

const MOCK_ICAL = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:入園式\nEND:VEVENT\nEND:VCALENDAR'

const mockTimedEvent: CalendarEvent = {
  event_id: 'abc123',
  document_id: 'doc1',
  document_title: '令和8年度春の行事予定',
  event_date: '2026-04-01',
  event_time: '10:00',
  event_title: '入園式',
  event_description: '春の入園式を行います。',
  ical_content: MOCK_ICAL,
}

const mockAllDayEvent: CalendarEvent = {
  event_id: 'def456',
  document_id: 'doc1',
  document_title: '令和8年度春の行事予定',
  event_date: '2026-05-01',
  event_time: null,
  event_title: '春の遠足',
  event_description: '公園への遠足を実施します。',
  ical_content: MOCK_ICAL,
}

const renderCard = (event: CalendarEvent) =>
  render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>
  )

describe('EventCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render event title and description', () => {
    renderCard(mockTimedEvent)

    expect(screen.getByText('入園式')).toBeInTheDocument()
    expect(screen.getByText('春の入園式を行います。')).toBeInTheDocument()
  })

  it('should display event date in Japanese locale format', () => {
    renderCard(mockTimedEvent)

    // 2026-04-01 → 2026年4月1日
    expect(screen.getByText(/2026年4月1日/)).toBeInTheDocument()
  })

  it('should display event_time when set', () => {
    renderCard(mockTimedEvent)

    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('should not display time when event_time is null', () => {
    renderCard(mockAllDayEvent)

    expect(screen.queryByText('10:00')).not.toBeInTheDocument()
  })

  it('should render download iCal button', () => {
    renderCard(mockTimedEvent)

    expect(screen.getByRole('button', { name: /iCal/ })).toBeInTheDocument()
  })

  it('should render document title as link to document page', () => {
    renderCard(mockTimedEvent)

    const link = screen.getByRole('link', { name: '令和8年度春の行事予定' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/documents/doc1')
  })

  it('should trigger download on iCal button click', () => {
    // Blob URL ダウンロードのモック
    const createObjectURL = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderCard(mockTimedEvent)

    fireEvent.click(screen.getByRole('button', { name: /iCal/ }))

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })
})
