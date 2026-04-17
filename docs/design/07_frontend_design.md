## 7. フロントエンド設計

### 7.1. 画面設計とインタラクション
- **ログインページ**: Googleアカウントでのログインボタンを配置。
- **ホーム**: ダッシュボード（ナビゲーション）。
- **予定一覧** (`/events`): 抽出されたイベント一覧をカード形式で表示。当日以降のイベントのみ表示（過去イベントは非表示）。Googleカレンダー登録リンク。
- **文書一覧** (`/documents`): PDFドキュメント一覧。種別フィルタ・日付ソート対応。
- **文書詳細** (`/documents/:id`): チャンク一覧（Markdownレンダリング）。
- **チャット** (`/chat`): RAGエージェントとの対話。
- **写真ギャラリー**: 未実装 / スコープ外。

### 7.2. 技術選定
- **フレームワーク**: Vite + React
- **UIライブラリ**: Material-UI (MUI)
- **ルーティング**: React Router
- **データフェッチング**: TanStack Query
- **状態管理**: Jotai（必要に応じて）
- **AIチャットUI**: CopilotKit（将来的に検討）
- **配信**: Cloud Storage（静的ホスティング）または Firebase Hosting

### 7.3. プロジェクト構成

```
frontend/
├── public/               # 静的ファイル
│   └── favicon.ico
├── src/
│   ├── main.tsx          # エントリーポイント
│   ├── App.tsx           # ルート定義
│   ├── pages/            # ページコンポーネント
│   │   ├── Login.tsx         # ログインページ
│   │   ├── Home.tsx          # ホーム
│   │   ├── Events.tsx        # 予定一覧
│   │   ├── Documents.tsx     # 文書一覧
│   │   ├── DocumentDetail.tsx # 文書詳細
│   │   └── Chat.tsx          # チャット
│   ├── components/       # 再利用可能なコンポーネント
│   │   ├── layout/            # レイアウト
│   │   ├── auth/              # 認証
│   │   ├── chat/              # チャットUI
│   │   ├── events/
│   │   │   ├── EventCard.tsx      # イベントカード
│   │   │   └── EventTable.tsx     # イベント表形式
│   │   └── documents/
│   │       ├── ChunkList.tsx      # チャンク一覧（Markdownレンダリング）
│   │       └── DocumentList.tsx   # 文書一覧
│   ├── hooks/            # カスタムフック
│   │   └── useAuth.ts    # 認証状態管理
│   ├── lib/              # ユーティリティ
│   │   └── api.ts        # APIクライアント
│   └── types/            # 型定義
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

### 7.4. フレームワーク選定の経緯

Vite + React構成を採用する理由：

1. **シンプルなアーキテクチャ**: SPAとして構築し、バックエンドAPIと明確に分離
2. **高速な開発体験**: ViteのHMR（ホットモジュールリプレースメント）による爆速開発
3. **低コストホスティング**: 静的ファイルとしてCloud Storageでホスティング可能
4. **責務の明確化**: UIロジックとビジネスロジックの分離
5. **将来の拡張性**: CopilotKitなどのAI UIライブラリを後から追加可能

### 7.5. APIクライアント実装例

```typescript
// src/lib/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // Cookieを送信
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }

  return res.json()
}

export const api = {
  documents: {
    list: () => fetchAPI<Document[]>('/api/documents'),
  },
  calendar: {
    getEvents: () => fetchAPI<Event[]>('/api/calendar/events'),
    syncEvent: (eventId: string) => fetchAPI('/api/calendar/sync', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    }),
  },
  photos: {
    list: (params?: { startDate?: string; endDate?: string }) =>
      fetchAPI<Photo[]>(`/api/photos?${new URLSearchParams(params)}`),
  },
  chat: {
    sendMessage: (message: string) => fetchAPI<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  },
}
```

### 7.6. ルーティング設計

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Gallery from './pages/Gallery'
import Unauthorized from './pages/Unauthorized'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <div>Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gallery"
          element={
            <ProtectedRoute>
              <Gallery />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### 7.7. ビルドとデプロイ

```bash
# ビルド
npm run build

# ビルド成果物は dist/ ディレクトリに出力される
# Cloud Storage または Firebase Hosting にデプロイ
gsutil -m rsync -r -d dist/ gs://your-bucket-name/
```
