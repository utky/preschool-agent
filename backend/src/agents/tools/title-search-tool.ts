import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { searchByTitle } from '../../lib/title-search.js'

export const titleSearchTool = createTool({
  id: 'title-search',
  description:
    '文書タイトルのキーワード検索。「給食」「献立」などタイトルに含まれる単語で文書を探すときに使う',
  inputSchema: z.object({
    keywords: z.array(z.string()).describe('タイトル検索キーワード配列'),
    limit: z.number().optional().default(10),
  }),
  execute: async (inputData) => {
    const results = await searchByTitle(inputData.keywords, inputData.limit)
    return { results: [...results] }
  },
})
