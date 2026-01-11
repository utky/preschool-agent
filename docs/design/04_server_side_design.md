## 4. サーバーサイド設計

サーバーサイドのロジックは、Hono + Mastraで実装します。HonoはEdgeランタイム対応の軽量なWebフレームワークで、MastraはAIエージェントフレームワークとして統合されます。

### 4.1. プロジェクト構成

```
backend/
├── src/
│   ├── index.ts              # Honoアプリケーションのエントリーポイント
│   ├── routes/               # APIルート定義
│   │   ├── auth.ts           # 認証エンドポイント
│   │   ├── chat.ts           # RAGエージェント（Mastra）
│   │   ├── calendar.ts       # カレンダー連携
│   │   ├── documents.ts      # ドキュメント管理
│   │   ├── photos.ts         # 写真ギャラリー
│   │   └── search.ts         # ベクトル検索
│   ├── middlewares/          # ミドルウェア
│   │   ├── auth.ts           # 認証チェック
│   │   └── cors.ts           # CORSポリシー
│   ├── agents/               # Mastraエージェント定義
│   │   └── rag-agent.ts      # RAGエージェント
│   ├── tools/                # Mastraツール（関数呼び出し）
│   │   ├── bigquery.ts       # BigQuery検索ツール
│   │   ├── calendar.ts       # カレンダー登録ツール
│   │   └── events.ts         # イベント検索ツール
│   ├── lib/                  # ユーティリティ・SDK
│   │   ├── bigquery.ts       # BigQueryクライアント
│   │   ├── oauth.ts          # OAuth認証ロジック
│   │   └── session.ts        # セッション管理
│   └── types/                # 型定義
├── Dockerfile                # Cloud Run用コンテナイメージ
├── package.json
└── tsconfig.json
```

### 4.2. 技術選定

- **Webフレームワーク**: Hono
  - 軽量・高速（Expressの代替）
  - TypeScript完全サポート
  - Edgeランタイム対応
  - Mastraが公式にHono統合をサポート

- **AIエージェント**: Mastra
  - RAGエージェントの構築
  - ツール（関数呼び出し）のサポート
  - Honoとの統合が簡単

- **認証**: `@hono/oauth-providers`
  - Google OAuthプロバイダー
  - HTTPOnly Cookieによるセッション管理

- **バリデーション**: Zod
  - リクエストボディのバリデーション
  - 型安全なAPI実装

### 4.3. 実装例

#### エントリーポイント（`src/index.ts`）

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRouter from './routes/auth'
import chatRouter from './routes/chat'
import calendarRouter from './routes/calendar'
import documentsRouter from './routes/documents'
import photosRouter from './routes/photos'
import searchRouter from './routes/search'
import { authMiddleware } from './middlewares/auth'

const app = new Hono()

// CORS設定（フロントエンドのオリジンを許可）
app.use('/*', cors({
  origin: process.env.FRONTEND_URL!,
  credentials: true,
}))

// 認証不要なルート
app.route('/api/auth', authRouter)

// 認証必須なルート
app.use('/api/*', authMiddleware)
app.route('/api/chat', chatRouter)
app.route('/api/calendar', calendarRouter)
app.route('/api/documents', documentsRouter)
app.route('/api/photos', photosRouter)
app.route('/api/search', searchRouter)

export default app
```

#### 認証ルート（`src/routes/auth.ts`）

```typescript
import { Hono } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import { createSession } from '../lib/session'

const auth = new Hono()

auth.use('/google', googleAuth({
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  scope: ['openid', 'email', 'profile'],
}))

auth.get('/google', async (c) => {
  const user = c.get('user-google')

  // メールアドレス認可チェック
  const allowedEmails = process.env.ALLOWED_USER_EMAILS?.split(',') || []
  if (!allowedEmails.includes(user.email)) {
    return c.redirect(`${process.env.FRONTEND_URL}/unauthorized`)
  }

  // セッション作成
  const sessionId = await createSession(user)

  // HTTPOnly Cookieでセッション返却
  c.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7日間
  })

  return c.redirect(`${process.env.FRONTEND_URL}/dashboard`)
})

auth.post('/logout', (c) => {
  c.cookie('session_id', '', { maxAge: 0 })
  return c.json({ success: true })
})

export default auth
```

### 4.4. データ処理

定期実行や非同期処理は、dbt（Cloud Run Job）とCloud Workflowで管理します。バックエンドAPIは同期的なリクエスト処理に専念します。
