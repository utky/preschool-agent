## 3. プロジェクト構成

本プロジェクトはNext.js (App Router) の標準的なディレクトリ構造を採用します。フロントエンドのUIコンポーネントとサーバーサイドのAPIエンドポイントが `app/` ディレクトリ内に共存するモノリシックな構成です。

```
/ (project root)
├── app/
│   ├── api/              # API Routes (バックエンドロジック)
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts # Auth.jsの認証エンドポイント
│   │   └── chat/
│   │       └── route.ts  # チャットAPIのエンドポイント
│   ├── components/       # Reactコンポーネント
│   ├── layout.tsx        # ルートレイアウト
│   └── page.tsx          # ルートページ
├── public/               # 静的ファイル (画像など)
├── docs/                 # ドキュメント
├── tf/                   # OpenTofu (IaC)
├── middleware.ts         # Next.jsミドルウェア (認証制御)
├── auth.ts               # Auth.js設定ファイル
├── next.config.ts        # Next.js設定ファイル
└── package.json          # プロジェクト依存関係
```
