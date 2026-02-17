import { useState } from 'react'
import { apiPost } from '@/lib/api'
import ChatWindow from '@/components/chat/ChatWindow'
import type { ChatMessage, ChatResponse } from '@/types/chat'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async (message: string) => {
    const userMessage: ChatMessage = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiPost<ChatResponse>('/api/chat', { message })
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setError('検索に失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onSend={handleSend}
        error={error}
      />
    </div>
  )
}
