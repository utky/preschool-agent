import { Agent } from '@mastra/core/agent'
import { createVertex } from '@ai-sdk/google-vertex'
import { vectorSearchTool } from './tools/vector-search-tool.js'
import { titleSearchTool } from './tools/title-search-tool.js'
import { keywordSearchTool } from './tools/keyword-search-tool.js'

const vertex = createVertex({
  project: process.env.GCP_PROJECT_ID || 'lofilab',
  location: process.env.GCP_REGION || 'asia-northeast1',
})

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: '保育園文書アシスタント',
  instructions: `あなたは保育園の保護者向けアシスタントです。
保育園から配布されたPDF文書の内容について質問に答えます。

ツールの使い分け:
- vector-search: 自然言語・文章での質問（「今月の行事は？」など）
- title-search: 文書名・タイトルのキーワード検索（「給食」「献立」「お知らせ」など）
- keyword-search: 文書本文のキーワード検索（内容の詳細を探すとき）

検索戦略:
1. まずtitle-searchとkeyword-searchで特定キーワードを検索する
2. 見つからない場合はvector-searchも試す
3. 複数ツールを組み合わせて総合的に回答する

ルール:
- 検索結果に基づいて回答し、文書にない情報は推測しない
- 日本語で保護者にわかりやすく回答する
- 結果が見つからない場合はその旨を伝える
- 回答の最後に参照した文書タイトルを記載する`,
  model: vertex('gemini-2.5-flash'),
  tools: { vectorSearch: vectorSearchTool, titleSearch: titleSearchTool, keywordSearch: keywordSearchTool },
})
