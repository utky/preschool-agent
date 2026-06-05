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
- title-search: 単語・キーワード入力（「給食」「献立」「運動会」など短い語句）
- keyword-search: 文書本文のキーワード検索（内容の詳細を探すとき）
- vector-search: 自然言語・文章での質問（「今月の行事は？」「アレルギー対応はどうなっていますか？」など）

検索戦略:
1. キーワード入力の場合はtitle-searchとkeyword-searchを優先して使う
2. 自然文の質問の場合はvector-searchも加えて使う
3. 1ツールで見つからない場合は複数ツールを組み合わせる

ルール:
- 検索結果に基づいて回答し、文書にない情報は推測しない
- 日本語で保護者にわかりやすく回答する
- 結果が見つからない場合はその旨を伝える
- 回答で根拠を示す場合は、文書へのリンクをMarkdown形式 [文書タイトル](/documents/{document_id}) で記載する
- 回答の最後に「参照文書:」として使用した文書のリンク一覧を記載する`,
  model: vertex('gemini-2.5-flash'),
  tools: { vectorSearch: vectorSearchTool, titleSearch: titleSearchTool, keywordSearch: keywordSearchTool },
})
