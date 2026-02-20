import { BigQuery } from '@google-cloud/bigquery'
import type { VectorSearchResult } from '../types/vector-search.js'

const bigquery = new BigQuery()
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'school_agent'
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'lofilab'

interface VectorSearchParams {
  readonly query: string
  readonly topK?: number
}

/** BigQuery VECTOR_SEARCH + インライン ML.GENERATE_EMBEDDING でセマンティック検索 */
export async function executeVectorSearch(
  params: VectorSearchParams
): Promise<readonly VectorSearchResult[]> {
  const { query, topK = 5 } = params

  const sql = `
    SELECT
      base.chunk_id,
      base.document_id,
      base.title,
      base.chunk_text,
      base.chunk_index,
      distance
    FROM VECTOR_SEARCH(
      TABLE \`${DATASET_ID}.fct_document_chunks\`,
      'chunk_embedding',
      (
        SELECT ml_generate_embedding_result AS chunk_embedding
        FROM ML.GENERATE_EMBEDDING(
          MODEL \`${PROJECT_ID}.${DATASET_ID}.text_embedding_model\`,
          (SELECT @query_text AS content),
          STRUCT('RETRIEVAL_QUERY' AS task_type, TRUE AS flatten_json_output)
        )
      ),
      top_k => @top_k,
      distance_type => 'COSINE'
    )
    ORDER BY distance ASC
  `

  const [rows] = await bigquery.query({
    query: sql,
    params: { query_text: query, top_k: topK },
  })
  return rows as VectorSearchResult[]
}
