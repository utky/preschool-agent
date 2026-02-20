import { Agent } from '@mastra/core/agent'
import { createVertex } from '@ai-sdk/google-vertex'
import { vectorSearchTool } from './tools/vector-search-tool.js'

const vertex = createVertex({
  project: process.env.GCP_PROJECT_ID || 'lofilab',
  location: process.env.GCP_REGION || 'asia-northeast1',
})

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: '保育園文書アシスタント',
  instructions: `あなたは保育園の保護者向けアシスタントです。
保育園から配布されたPDF文書の内容について質問に答えます。

ルール:
- vector-searchツールを使って関連文書を検索してから回答する
- 検索結果に基づいて回答し、文書にない情報は推測しない
- 日本語で保護者にわかりやすく回答する
- 結果が見つからない場合はその旨を伝える
- 回答の最後に参照した文書タイトルを記載する`,
  model: vertex('gemini-2.5-flash'),
  tools: { vectorSearch: vectorSearchTool },
})
