import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { searchChunks } from '../../lib/chat-search.js'

export const keywordSearchTool = createTool({
  id: 'keyword-search',
  description:
    '文書本文のキーワード全文検索。文書の中身（テキスト）にキーワードが含まれる箇所を探すときに使う',
  inputSchema: z.object({
    keywords: z.array(z.string()).describe('本文検索キーワード配列'),
  }),
  execute: async (inputData) => {
    const results = await searchChunks(inputData.keywords)
    return { results: [...results] }
  },
})
