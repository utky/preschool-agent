# 設計書

このドキュメントは `requirements.md` に基づくシステム設計を定義します。

## 1. アーキテクチャ概要

（変更なし）

## 2. PDF解析アプローチ

（変更なし）

## 3. プロジェクト構成

バックエンドとフロントエンドは、プロジェクトルートで明確に分離したモノレポ構成とします。

```
/ (project root)
├── backend/            # バックエンド (Python, FastAPI)
│   ├── src/
│   │   ├── core/
│   │   ├── tools/
│   │   ├── services/
│   │   └── api/
│   ├── functions/      # Cloud Functions のエントリーポイント
│   └── pyproject.toml
├── frontend/           # フロントエンド (TypeScript, React)
│   ├── src/
│   │   ├── components/ # 再利用可能なUI部品
│   │   ├── pages/      # 各画面のメインコンポーネント
│   │   ├── services/   # API連携など
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/
└── .gitignore
```

## 4. バックエンド モジュール設計

`backend/src` ディレクトリ配下に、責務に応じてモジュールを分割します。

- `backend/src/core`:
    - **責務**: ビジネスロジックとドメインモデルを定義します。
    - **内容**: `models.py`, `mappers.py`
- `backend/src/tools`:
    - **責務**: 外部サービスとの連携を行います。
    - **内容**: `gcp/storage.py`, `gcp/bigquery.py`, `gcp/document_ai.py`
- `backend/src/services`:
    - **責務**: ビジネスロジックと外部連携を組み合わせてユースケースを実現します。
    - **内容**: `document_processor.py`, `agent_service.py`

## 5. データモデル設計 (Pydantic & BigQuery)

（変更なし）

## 6. APIエンドポイント設計 (FastAPI)

（変更なし）

## 7. フロントエンド設計

### 7.1. 画面設計

（変更なし。ダッシュボード、写真ギャラリー、カレンダーの3画面構成）

### 7.2. 技術選定
- **フレームワーク**: **React** (Vite を使用したTypeScriptプロジェクト)
- **UIライブラリ**: **Material-UI (MUI)** - Googleのデザインシステムに準拠し、高品質なコンポーネントを迅速に構築するため。
- **状態管理**: React Context API (本プロジェクトの規模では十分) 
- **APIクライアント**: Axios
- **デプロイ先**: Firebase Hosting

## 8. インフラストラクチャとCI/CD

- **コンピューティング**: Cloud Functions, Cloud Run
- **スケジューリング**: Cloud Scheduler
- **AI / ML**: Document AI
- **ストレージ**: Google Drive, Cloud Storage, BigQuery
- **認証**: Identity-Aware Proxy (IAP)
- **フロントエンドホスティング**: Firebase Hosting
- **CI/CD**: GitHub Actions
