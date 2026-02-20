import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { executeVectorSearch } from '../../lib/vector-search.js'

export const vectorSearchTool = createTool({
  id: 'vector-search',
  description: '保育園の配布文書からセマンティック検索を行う',
  inputSchema: z.object({
    query: z.string().describe('検索クエリ'),
    topK: z.number().optional().default(5).describe('返す結果数'),
  }),
  execute: async (inputData) => {
    const results = await executeVectorSearch({ query: inputData.query, topK: inputData.topK })
    return { results: [...results] }
  },
})
