import { Link } from 'react-router-dom'
import type { ChatSource } from '@/types/chat'

interface SourceCardProps {
  readonly source: ChatSource
}

export default function SourceCard({ source }: SourceCardProps) {
  return (
    <Link
      to={`/documents/${source.document_id}`}
      className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-medium text-indigo-600 truncate">{source.title}</p>
      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{source.chunk_text}</p>
    </Link>
  )
}
