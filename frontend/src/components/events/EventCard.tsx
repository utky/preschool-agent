import { Link } from 'react-router-dom'
import type { CalendarEvent } from '@/types/events'

interface Props {
  event: CalendarEvent
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

// Google CalendarのイベントテンプレートURLを生成する（純粋関数）
function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const [year, month, day] = event.event_date.split('-')
  const pad = (n: number) => String(n).padStart(2, '0')
  let dates: string

  if (event.event_time) {
    // 時刻あり: 開始〜+1時間
    const [hour, minute] = event.event_time.split(':').map(Number)
    const endHour = (hour + 1) % 24
    const start = `${year}${month}${day}T${pad(hour)}${pad(minute)}00`
    const end = `${year}${month}${day}T${pad(endHour)}${pad(minute)}00`
    dates = `${start}/${end}`
  } else {
    // 終日: 翌日が終了日（Google Calendarの終日イベントは終了日が排他的）
    const next = new Date(Number(year), Number(month) - 1, Number(day) + 1)
    const endStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    dates = `${year}${month}${day}/${endStr}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.event_title,
    dates,
    details: event.event_description,
    ctz: 'Asia/Tokyo',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
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
        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          title="Google Calendarに追加"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          追加
        </a>
      </div>
    </div>
  )
}
