# TODO

## 1. 環境構築
- [ ] `backend` ディレクトリの作成と既存ソースコードの移動
- [ ] `frontend` ディレクトリの作成と React (Vite) プロジェクトのセットアップ
- [ ] `pyproject.toml` の依存関係設定
- [ ] `frontend/package.json` の依存関係設定 (MUI, Axios)
- [ ] `README.md` の更新 (新しい構成でのセットアップ手順)
- [ ] `.devcontainer` の設定見直し (Node.js, Python両方の開発環境を整備)

## 2. コアモジュール開発 (TDD)
- [ ] `backend/src/core/models.py`: Pydanticモデルの定義
- [ ] `backend/src/core/mappers.py`: Document AIの出力をPydanticモデルへ変換するマッパーの実装とテスト

## 3. ツールモジュール開発
- [ ] `backend/src/tools/gcp/storage.py`: Cloud Storage操作用ラッパー
- [ ] `backend/src/tools/gcp/bigquery.py`: BigQuery操作用ラッパー
- [ ] `backend/src/tools/gcp/document_ai.py`: Document AI API操作用ラッパー

## 4. バックエンドサービス・API開発
- [ ] `functions/main.py`: PDF処理Cloud Functionの実装
- [ ] `backend/src/api/main.py`: FastAPIアプリケーションの基本設定
- [ ] `backend/src/services/`: 各サービスロジックの実装
- [ ] IaC (Terraformなど) の設定ファイル作成 (Cloud Scheduler, Document AI Processor, Firebase Hostingを含む)

## 5. フロントエンド開発
- [ ] 共通レイアウト（ヘッダー、ナビゲーション）コンポーネントの実装
- [ ] ダッシュボード画面の実装 (AIチャット、カレンダー候補)
- [ ] 写真ギャラリー画面の実装
- [ ] カレンダー画面の実装
- [ ] バックエンドAPIとの連携処理の実装

## 6. 結合テストとデプロイ
- [ ] E2Eテストの作成
- [ ] GitHub ActionsによるCI/CDパイプラインの構築 (バックエンドデプロイ, フロントエンドデプロイ)
