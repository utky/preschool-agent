export interface VectorSearchResult {
  readonly chunk_id: string
  readonly document_id: string
  readonly title: string
  readonly chunk_text: string
  readonly chunk_index: number
  readonly distance: number
}
