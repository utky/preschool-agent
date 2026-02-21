import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/types/chat'

interface MessageBubbleProps {
  readonly message: ChatMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // ソースをdocument_idで重複排除
  const uniqueSources = message.sources
    ? [...new Map(message.sources.map((s) => [s.document_id, s])).values()]
    : []

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-800 shadow-sm border border-gray-200'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {uniqueSources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Sources:</p>
            <div className="flex flex-wrap gap-1">
              {uniqueSources.map((source) => (
                <Link
                  key={source.document_id}
                  to={`/documents/${source.document_id}`}
                  className="text-xs text-indigo-600 hover:text-indigo-500 underline"
                >
                  {source.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
