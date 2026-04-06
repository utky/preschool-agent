export interface CalendarEvent {
  readonly event_id: string
  readonly document_id: string
  readonly document_title: string        // 出典ドキュメントタイトル
  readonly event_date: string            // YYYY-MM-DD
  readonly event_time: string | null     // HH:MM (nullable)
  readonly event_title: string
  readonly event_description: string
  readonly ical_content: string          // iCalテキスト（Blobダウンロード用）
}

export interface EventsResponse {
  readonly events: readonly CalendarEvent[]
}
