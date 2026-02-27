import type { CalendarEvent } from '@/types/events'

interface Props {
  event: CalendarEvent
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
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
        </div>
        {event.is_synced && (
          <span className="flex-shrink-0 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            登録済み
          </span>
        )}
      </div>
    </div>
  )
}
