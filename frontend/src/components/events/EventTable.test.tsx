import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import EventTable from './EventTable'
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

const renderTable = (events: readonly CalendarEvent[]) =>
  render(
    <MemoryRouter>
      <EventTable events={events} />
    </MemoryRouter>
  )

describe('EventTable', () => {
  it('should render table headers', () => {
    renderTable([mockTimedEvent])

    expect(screen.getByText('日付')).toBeInTheDocument()
    expect(screen.getByText('時刻')).toBeInTheDocument()
    expect(screen.getByText('タイトル')).toBeInTheDocument()
    expect(screen.getByText('文書')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'カレンダー' })).toBeInTheDocument()
  })

  it('should render one row per event', () => {
    renderTable([mockTimedEvent, mockAllDayEvent])

    expect(screen.getByText('入園式')).toBeInTheDocument()
    expect(screen.getByText('春の遠足')).toBeInTheDocument()
  })

  it('should display event_date in Japanese format', () => {
    renderTable([mockTimedEvent])

    expect(screen.getByText('2026年4月1日')).toBeInTheDocument()
  })

  it('should display event_time when set', () => {
    renderTable([mockTimedEvent])

    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('should display "-" when event_time is null', () => {
    renderTable([mockAllDayEvent])

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('should render document_title as a Link to /documents/:id', () => {
    renderTable([mockTimedEvent])

    const link = screen.getByRole('link', { name: '令和8年度春の行事予定' })
    expect(link).toHaveAttribute('href', '/documents/doc1')
  })

  it('should render Google Calendar link for each event', () => {
    renderTable([mockTimedEvent, mockAllDayEvent])

    const links = screen.getAllByRole('link')
    const gcalLinks = links.filter((l) => l.getAttribute('href')?.includes('calendar.google.com'))
    expect(gcalLinks).toHaveLength(2)
  })

  it('should show empty message when events array is empty', () => {
    renderTable([])

    expect(screen.getByText('イベントはありません')).toBeInTheDocument()
  })
})
