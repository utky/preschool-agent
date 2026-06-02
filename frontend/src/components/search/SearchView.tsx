import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SourceCard from './SourceCard'
import type { SearchResult } from '@/types/chat'

interface SearchViewProps {
  readonly result: SearchResult | null
  readonly isLoading: boolean
  readonly onSearch: (query: string) => void
  readonly error?: string | null
}

export default function SearchView({ result, isLoading, onSearch, error }: SearchViewProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed.length === 0) return
    onSearch(trimmed)
  }

  const uniqueSources = result
    ? [...new Map(result.sources.map((s) => [s.document_id, s])).values()]
    : []

  const hasResult = result !== null

  return (
    <div className="flex flex-col gap-6">
      {/* 検索バー */}
      <form
        onSubmit={handleSubmit}
        className={`flex gap-2 transition-all ${!hasResult && !isLoading ? 'mt-16' : ''}`}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="キーワードまたは質問を入力..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          aria-label="検索"
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          検索
        </button>
      </form>

      {/* 初期ヒント */}
      {!hasResult && !isLoading && (
        <p className="text-center text-sm text-gray-400">
          保育園から配布された文書を検索できます
        </p>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="flex justify-center" data-testid="loading-indicator">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 検索結果 */}
      {result && !isLoading && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">回答</h2>
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
            </div>
          </div>

          {uniqueSources.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">参照文書</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uniqueSources.map((source) => (
                  <SourceCard key={source.document_id} source={source} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
