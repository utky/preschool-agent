import { useState } from 'react'
import { apiPost } from '@/lib/api'
import SearchView from '@/components/search/SearchView'
import type { ChatResponse, SearchResult } from '@/types/chat'

export default function Search() {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiPost<ChatResponse>('/api/chat', { message: query })
      setResult({ answer: data.response, sources: data.sources })
    } catch {
      setError('検索に失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">文書を調べる</h1>
      <SearchView
        result={result}
        isLoading={isLoading}
        onSearch={handleSearch}
        error={error}
      />
    </div>
  )
}
