# TODO (スライスベース計画)

このタスクリストは、小さく完全な機能スライスを継続的にデプロイしていくアジャイルなアプローチに基づいています。

---

### フェーズ 0: 開発プロセスの定義

- [x] 開発フローを `GEMINI.md` に記載する

---

### フェーズ 0.5: アーキテクチャ移行（Next.js → Vite + React + Hono + Mastra）

**目標:** 現在のNext.jsアーキテクチャから、Vite + React（フロントエンド）+ Hono + Mastra（バックエンド）の構成に移行する。

**背景:** Next.jsを本来の役割（BFF）を超えてフルバックエンドとして使用していたが、責務の明確化とコスト最適化のため、SPAとAPIサーバーに分離する。

- [ ] **バックエンド (Hono + Mastra):**
    - [ ] `backend/` ディレクトリを作成し、Honoプロジェクトをセットアップ
    - [ ] 認証実装（`@hono/oauth-providers` でGoogle OAuth）
    - [ ] セッション管理実装（BigQueryベース）
    - [ ] 認証ミドルウェア実装
    - [ ] Dockerfileを作成（Cloud Run用）
- [ ] **フロントエンド (Vite + React):**
    - [ ] `frontend/` ディレクトリを作成し、Viteプロジェクトをセットアップ
    - [ ] React Router導入
    - [ ] APIクライアント実装（`credentials: 'include'`でCookie送信）
    - [ ] 認証フック実装（`useAuth`）
    - [ ] ログインページ実装
- [ ] **インフラ (IaC):**
    - [ ] `auth` モジュールを作成（OAuth設定、Secret Manager）
    - [ ] `backend` モジュールを作成（Hono用Cloud Run）
    - [ ] `frontend` モジュールを作成（Cloud Storage静的ホスティング）
    - [ ] セッションテーブルをBigQueryに追加
- [ ] **CI/CD:**
    - [ ] バックエンドビルド・デプロイワークフローを追加
    - [ ] フロントエンドビルド・デプロイワークフローを追加
    - [ ] 既存のNext.jsワークフローを削除
- [ ] **既存コードの移行:**
    - [ ] `/api/health` エンドポイントをHonoに移行
    - [ ] フロントエンドページをReactに移行
    - [ ] 動作確認（Health Check）

---

### フェーズ 1: パイプラインの確立 (Health-Checkスライス)

**目標:** 最小限のアプリケーションを本番環境にデプロイし、CI/CDパイプラインを完全に確立する。

- [x] **環境構築:**
    - [x] devcontainer の設定整備
- [x] **インフラ (IaC):**
    - [x] OpenTofuで最小限のリソースを定義 (Cloud Run, IAP, Artifact Registry, GCS for Tofu state)
- [x] **バックエンド (Next.js):**
    - [x] `GET /api/health` エンドポイントを1つ作成
- [x] **フロントエンド (React):**
    - [x] `/api/health` を呼び出し、結果を表示するだけのシンプルなページを作成
- [x] **CI/CD (GitHub Actions):**
    - [x] **CI:** `tofu plan` と最小限のテストを実行するPRワークフローを構築
    - [x] **CD:** アプリをビルド・コンテナ化し、Cloud Runへ自動デプロイするワークフローを構築

---

### フェーズ 1.5: インフラ構成のリファクタリング - DONE

**目標:** Terraformの構成をベストプラクティスに準拠させ、保守性とセキュリティを向上させる。

- [x] **インフラ (IaC):**
    - [x] OpenTofuのディレクトリ構造を `environments` と `modules` を使う構成に再編成する
    - [x] CI/CDからGoogle Cloudへの認証をWorkload Identity連携に移行する
    - [x] 既存リソース（Cloud Run, IAP, GCSなど）を機能ごとのモジュールに分割する

---

### フェーズ 1.6: 開発環境の改善 - DONE

**目標:** devcontainerにOpenTofuの実行環境を構築する。

- [x] **環境構築:**
    - [x] `docs/requirements.md` にOpenTofuの要件を追記する
    - [x] `.devcontainer/Dockerfile` を更新し、OpenTofuのバージョン管理ツール `tenv` をインストールする
    - [x] `.devcontainer/devcontainer.json` を更新し、コンテナ作成時に `tenv` を使ってOpenTofuをインストールする

---

### フェーズ 2: PDF処理基盤スライス

**目標:** Document AIによるPDF解析からdbtパイプライン、ベクトル検索までの基盤を段階的に構築する。

> 参照: `docs/design/02_pdf_parsing.md`

#### 2.1: Document AI PoC

**目標:** Document AIの解析結果を確認し、テーブル設計を検証・最適化する。

- [ ] **インフラ (IaC):**
    - [ ] `gcs` モジュールを作成（PDF uploads用バケット）
    - [ ] `bigquery` モジュールを作成（データセット、Vertex AI接続）
    - [ ] `document_ai` モジュールを作成（Document OCRプロセッサー）
- [ ] **BigQuery:**
    - [ ] BigQuery Object Table (`raw_documents`) を作成
    - [ ] サンプルPDFでML.PROCESS_DOCUMENTをテスト実行
    - [ ] 解析結果を確認し、テーブル設計を最終化

#### 2.2: dbt基本パイプライン

**目標:** テキスト抽出、チャンク化、メタデータ管理の基本フローを実装する。

- [ ] **インフラ (IaC):**
    - [ ] `cloud_run_job` モジュールを作成（dbt実行環境）
    - [ ] Artifact Registry にdbtイメージ用リポジトリを作成
- [ ] **dbt:**
    - [ ] dbtプロジェクト構造をセットアップ (`models/`, `macros/`, `tests/`)
    - [ ] `stg_documents_text` モデルを実装（ML.PROCESS_DOCUMENTでテキスト抽出）
    - [ ] UUID v4生成マクロを実装
    - [ ] `int_document_chunks` モデルを実装（チャンク化、UUID割り当て）
    - [ ] `documents` テーブルモデルを実装（正規化メタデータ）
    - [ ] `document_chunks` テーブルモデルを実装（冗長メタデータ含む）
- [ ] **バックエンド (TDD):**
    - [ ] 処理済みドキュメント一覧を返す `GET /api/documents` エンドポイントを実装
- [ ] **フロントエンド (TDD):**
    - [ ] `/api/documents` から取得したドキュメント一覧を表示するページを作成

#### 2.3: 埋め込み生成とベクトル検索基盤

**目標:** Vertex AI Embeddingによる埋め込み生成とVector Indexを実装する。

- [ ] **dbt:**
    - [ ] Vertex AI Embeddingモデルの接続設定
    - [ ] `int_document_embeddings` モデルを実装（ML.GENERATE_EMBEDDING）
    - [ ] Vector Indexを作成（`document_chunks.chunk_embedding`）
- [ ] **バックエンド (TDD):**
    - [ ] ベクトル検索を実行する `POST /api/search` エンドポイントを実装
- [ ] **フロントエンド (TDD):**
    - [ ] 検索UIを作成し、検索結果を表示

---

### フェーズ 3: 文書種別の構造化スライス

**目標:** 各文書種別（journal, photo_album等）に特化したテーブルを実装する。

- [ ] **dbt:**
    - [ ] 文書種別分類ロジックを実装
    - [ ] `journal` テーブルモデルを実装（sections構造化）
    - [ ] `photo_album` テーブルモデルを実装（sections, schedule, announcements）
    - [ ] `monthly_announcement` テーブルモデルを実装
    - [ ] `monthly_lunch_schedule` テーブルモデルを実装（日別メニュー、栄養情報）
    - [ ] `monthly_lunch_info` テーブルモデルを実装
    - [ ] `photos` テーブルモデルを実装（画像抽出ロジック）
    - [ ] `uncategorized` テーブルモデルを実装
- [ ] **バックエンド (TDD):**
    - [ ] 文書種別ごとのエンドポイントを実装（`GET /api/documents/{type}`）
- [ ] **フロントエンド (TDD):**
    - [ ] 文書種別ごとの詳細表示ページを作成

---

### フェーズ 4: イベント抽出とカレンダー連携スライス

**目標:** PDFからイベントを抽出し、Googleカレンダーに登録する機能を実装する。

> 参照: `docs/design/02_pdf_parsing.md` セクション 2.2 (`extracted_events`, `calendar_sync_history`)

- [ ] **dbt:**
    - [ ] `extracted_events` テーブルモデルを実装（正規化イベント管理）
    - [ ] `calendar_sync_history` テーブルモデルを実装
    - [ ] `upcoming_events` ビューを実装（未登録イベント取得）
- [ ] **インフラ (IaC):**
    - [ ] `app` モジュールのサービスアカウントにGoogle Calendar APIの権限を追加
- [ ] **バックエンド (TDD):**
    - [ ] `GET /api/calendar/events` エンドポイントを実装（未登録イベント一覧）
    - [ ] `POST /api/calendar/sync` エンドポイントを実装（ワンタップ登録、重複防止）
- [ ] **フロントエンド (TDD):**
    - [ ] イベント一覧画面を作成（カードベース、モバイル最適化）
    - [ ] ワンタップ登録ボタンと登録済みバッジを実装
    - [ ] 楽観的UI更新を実装

---

### フェーズ 5: RAGエージェント (チャット) スライス

**目標:** 蓄積されたデータに対する自然言語での問い合わせに応答するAIエージェントを実装する。

- [ ] **バックエンド (TDD):**
    - [ ] Mastra をセットアップ
    - [ ] BigQueryベクトル検索ツールを実装
    - [ ] `extracted_events` 検索ツールを実装
    - [ ] カレンダー登録ツールを実装（エージェントからの自動登録）
    - [ ] `POST /api/chat` エンドポイントとセッション管理を実装
- [ ] **フロントエンド (TDD):**
    - [ ] AIと対話するためのチャットUIコンポーネントを作成
    - [ ] ダッシュボードに統合

---

### フェーズ 6: Google Drive連携と自動化スライス

**目標:** Google Driveを監視し、新規ファイルを自動的に検出・処理する仕組みを構築する。

- [ ] **インフラ (IaC):**
    - [ ] `cloud_workflow` モジュールを作成（dbt実行オーケストレーション）
    - [ ] `cloud_scheduler` モジュールを作成（定期実行）
    - [ ] サービスアカウントのIAM権限を設定
- [ ] **Google Apps Script:**
    - [ ] Google DriveからGCSへのPDF転送スクリプトを実装
    - [ ] エラーハンドリングとリトライロジックを実装
- [ ] **Cloud Workflow:**
    - [ ] dbt実行ワークフローを実装
    - [ ] エラー通知を実装

---

### フェーズ 7: 写真ギャラリースライス

**目標:** PDFから抽出した写真をWeb UI上で閲覧できるようにする。

- [ ] **バックエンド (TDD):**
    - [ ] 署名付きURLを返す `GET /api/photos` エンドポイントを実装
    - [ ] 写真のフィルタリング機能を実装（日付、文書種別等）
- [ ] **フロントエンド (TDD):**
    - [ ] 写真を一覧表示するギャラリーページを作成
    - [ ] 画像の遅延読み込みとサムネイル表示を実装
