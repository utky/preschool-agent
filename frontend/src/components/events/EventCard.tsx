import type { CalendarEvent } from '@/types/events'

interface Props {
  event: CalendarEvent
}

// イベントタイプごとの色定義
const EVENT_TYPE_COLORS: Record<string, string> = {
  入園式: 'bg-pink-100 text-pink-800',
  卒園式: 'bg-purple-100 text-purple-800',
  遠足: 'bg-green-100 text-green-800',
  運動会: 'bg-orange-100 text-orange-800',
  発表会: 'bg-blue-100 text-blue-800',
  保護者会: 'bg-yellow-100 text-yellow-800',
}

const DEFAULT_COLOR = 'bg-gray-100 text-gray-800'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export default function EventCard({ event }: Props) {
  const typeColor = EVENT_TYPE_COLORS[event.event_type] ?? DEFAULT_COLOR

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm text-gray-500">{formatDate(event.event_date)}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}>
              {event.event_type}
            </span>
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
