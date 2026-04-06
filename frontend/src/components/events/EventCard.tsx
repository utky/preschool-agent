import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/types/events'

interface Props {
  event: CalendarEvent
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

// iCalファイルをダウンロードする（純粋関数）
function downloadIcal(icalContent: string, title: string): void {
  const blob = new Blob([icalContent], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // タイトルからファイル名に使えない文字を除去
  a.download = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function EventCard({ event }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm text-gray-500">{formatDate(event.event_date)}</span>
            {event.event_time && (
              <span className="text-sm text-gray-500">{event.event_time}</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900 truncate">{event.event_title}</h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{event.event_description}</p>
          <Link
            to={`/documents/${event.document_id}`}
            className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
          >
            {event.document_title}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => downloadIcal(event.ical_content, event.event_title)}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          title="iCalをダウンロード"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          iCal
        </button>
      </div>
    </div>
  )
}
