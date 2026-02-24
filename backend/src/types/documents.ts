export interface DocumentMetadata {
  readonly document_id: string
  readonly uri: string
  readonly title: string
  readonly document_type: string | null
  readonly publish_date: string | null
  readonly content_type: string
  readonly size: number
  readonly total_chunks: number
  readonly updated_at: string
  readonly signed_url?: string
}

export interface DocumentChunk {
  readonly chunk_id: string
  readonly document_id: string
  readonly chunk_index: number
  readonly chunk_text: string
  readonly title: string
  readonly document_type: string | null
  readonly publish_date: string | null
}

export interface DocumentDetailResponse {
  readonly document: DocumentMetadata
  readonly chunks: readonly DocumentChunk[]
}

export interface TriggerJobResponse {
  readonly success: boolean
  readonly executionId?: string
  readonly error?: string
}
