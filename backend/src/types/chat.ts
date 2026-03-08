export type MessageRole = 'user' | 'assistant'

export interface ChatSource {
  readonly document_id: string
  readonly title: string
  readonly chunk_text: string
  readonly chunk_index: number
}

export interface ChatHistoryMessage {
  readonly role: MessageRole
  readonly content: string
}

export interface ChatRequest {
  readonly message: string
  readonly history?: readonly ChatHistoryMessage[]
}

export interface ChatResponse {
  readonly response: string
  readonly sources: readonly ChatSource[]
}

export interface ChatMessage {
  readonly role: MessageRole
  readonly content: string
  readonly sources?: readonly ChatSource[]
}
