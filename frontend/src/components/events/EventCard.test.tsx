import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EventCard from './EventCard'
import type { CalendarEvent } from '@/types/events'

const mockSyncedEvent: CalendarEvent = {
  event_id: 'abc123',
  document_id: 'doc1',
  document_title: '令和8年度春の行事予定',
  event_date: '2026-04-01',
  event_time: '10:00',
  event_title: '入園式',
  event_description: '春の入園式を行います。',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: true,
  calendar_event_id: 'gcal_001',
  synced_at: '2026-02-10T10:00:00Z',
}

const mockUnsyncedEvent: CalendarEvent = {
  event_id: 'def456',
  document_id: 'doc1',
  document_title: '令和8年度春の行事予定',
  event_date: '2026-05-01',
  event_time: null,
  event_title: '春の遠足',
  event_description: '公園への遠足を実施します。',
  extracted_at: '2026-02-01T00:00:00Z',
  is_synced: false,
  calendar_event_id: null,
  synced_at: null,
}

describe('EventCard', () => {
  it('should render event title and description', () => {
    render(<EventCard event={mockSyncedEvent} />)

    expect(screen.getByText('入園式')).toBeInTheDocument()
    expect(screen.getByText('春の入園式を行います。')).toBeInTheDocument()
  })

  it('should display event date in Japanese locale format', () => {
    render(<EventCard event={mockSyncedEvent} />)

    // 2026-04-01 → 2026年4月1日
    expect(screen.getByText(/2026年4月1日/)).toBeInTheDocument()
  })

  it('should display event_time when set', () => {
    render(<EventCard event={mockSyncedEvent} />)

    expect(screen.getByText('10:00')).toBeInTheDocument()
  })

  it('should not display time when event_time is null', () => {
    render(<EventCard event={mockUnsyncedEvent} />)

    expect(screen.queryByText('10:00')).not.toBeInTheDocument()
  })

  it('should show synced badge when is_synced is true', () => {
    render(<EventCard event={mockSyncedEvent} />)

    expect(screen.getByText('登録済み')).toBeInTheDocument()
  })

  it('should not show synced badge when is_synced is false', () => {
    render(<EventCard event={mockUnsyncedEvent} />)

    expect(screen.queryByText('登録済み')).not.toBeInTheDocument()
  })

  it('should render unsynced event without badge', () => {
    render(<EventCard event={mockUnsyncedEvent} />)

    expect(screen.getByText('春の遠足')).toBeInTheDocument()
    expect(screen.getByText('公園への遠足を実施します。')).toBeInTheDocument()
    expect(screen.queryByText('登録済み')).not.toBeInTheDocument()
  })
})
