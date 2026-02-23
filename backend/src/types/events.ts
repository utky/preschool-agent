export interface CalendarEvent {
  readonly event_id: string
  readonly document_id: string
  readonly event_date: string      // YYYY-MM-DD
  readonly event_type: string
  readonly event_title: string
  readonly event_description: string
  readonly extracted_at: string
  readonly is_synced: boolean
  readonly calendar_event_id: string | null
  readonly synced_at: string | null
}

export interface EventsResponse {
  readonly events: readonly CalendarEvent[]
}

export interface CalendarSyncResult {
  readonly synced: number
  readonly skipped: number
  readonly failed: number
  readonly errors: readonly string[]
}
