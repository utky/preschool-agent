# TODO (E2E機能段階追加スライス計画 - プランC改)

このタスクリストは、Vite + React + Hono + Mastra構成でE2Eを維持しながら段階的に機能を追加するアプローチに基づいています。

> 詳細: `docs/design/10_slice_plan.md`

---

## 進捗サマリー

| スライス | 内容 | 状態 |
|---------|------|------|
| 0 | アーキテクチャ移行 (Next.js → Vite + Hono) | **DONE** |
| 7 | Google Drive → GCS自動連携 | **DONE** |
| 1 | Document AI + BigQuery基盤 | **DONE** |
| 2 | dbtパイプライン | **DONE** |
| 3 | キーワード検索チャット | TODO |
| 4 | ベクトル検索 + Mastra統合 | TODO |
| 5 | イベント抽出 + カレンダー登録 | TODO |
| 6 | 文書種別構造化 | TODO |

### 次のアクション
1. **スライス3**: キーワード検索チャットを実装
2. チャットUI（ChatWindow、MessageBubble）の構築
3. BigQuery LIKE検索によるテキスト検索API

---

## スライス0: アーキテクチャ移行（Next.js → Vite + React + Hono + Mastra）- DONE

**目標:** Next.js 15を廃止し、設計書準拠のVite + React + Hono構成に移行する。

**コミット:** `9da87d6` feat(slice0): Next.js → Vite + React + Hono アーキテクチャ移行

- [x] **フロントエンド (Vite + React):**
    - [x] `frontend/` ディレクトリを作成し、Viteプロジェクトをセットアップ
    - [x] React Router導入（`/`, `/login`, `/documents`）
    - [x] APIクライアント実装（`credentials: 'include'`でCookie送信）
    - [x] 認証フック実装（`useAuth`）
    - [x] ログインページ、ホームページ実装
    - [x] Navbar、Layout コンポーネント実装
- [x] **バックエンド (Hono):**
    - [x] `backend/` ディレクトリを作成し、Honoプロジェクトをセットアップ
    - [x] Google OAuth実装（`/api/auth/signin/google`, `/api/auth/callback/google`）
    - [x] JWT認証実装（`hono/jwt`使用、90日有効期限）
    - [x] 認証ミドルウェア実装（JWT検証）
    - [x] メールホワイトリスト実装（`ALLOWED_USER_EMAILS`）
    - [x] Health Checkエンドポイント（`GET /api/health`）
    - [x] Dockerfile作成
- [x] **インフラ (IaC):**
    - [x] フロントエンド用Cloud Storageバケット追加（公開、CORS設定）
    - [x] API Data用Cloud Storageバケット追加
    - [x] Cloud Run設定を更新（環境変数追加）
- [x] **CI/CD:**
    - [x] バックエンドビルド・デプロイワークフローを更新
    - [x] フロントエンドビルド・Cloud Storageデプロイを追加
- [x] **既存コードの削除:**
    - [x] `src/` ディレクトリ（Next.js）を削除
    - [x] `next.config.ts`, `Dockerfile.prod` を削除
    - [x] ルートpackage.jsonをワークスペース構成に更新

---

## スライス7: Google Drive → GCS自動連携 - DONE

**目標:** Google Driveの指定フォルダを監視し、新規PDFを自動的にGCSにコピーする。

**コミット:** `27512cd` feat(slice7): Google Drive → GCS自動連携 (GAS)

- [x] **Google Apps Script:**
    - [x] `gas/` ディレクトリを作成
    - [x] Drive監視ロジック実装（`src/drive.ts`）
    - [x] GCS転送ロジック実装（`src/gcs.ts`）
    - [x] 設定管理実装（`src/config.ts`）
    - [x] メインエントリーポイント実装（`src/main.ts`）
    - [x] 重複防止ロジック実装
    - [x] エラーハンドリング（指数バックオフ）
- [x] **インフラ (IaC):**
    - [x] PDF uploads用GCSバケット追加（ライフサイクル: 90日→Coldline、365日→削除）
    - [x] GAS用サービスアカウント追加
    - [x] IAM権限設定（`roles/storage.objectCreator`）
- [x] **CI/CD:**
    - [x] GASデプロイワークフロー追加（`.github/workflows/deploy-gas.yml`）
- [x] **運用設定（手動）:**
    - [x] Script Properties設定（`DRIVE_FOLDER_ID`, `GCS_BUCKET_NAME`, `GCP_PROJECT_ID`）
    - [x] サービスアカウントキー生成・登録（`GCS_SERVICE_ACCOUNT_KEY`）
    - [x] `setupTrigger()` 実行（1時間ごとの定期実行トリガー設定）

---

## スライス1: Document AI + BigQuery基盤 - DONE

**目標:** GCS内のPDFをDocument AIで解析し、BigQueryに格納する基盤を構築。

**コミット:** `e4bfff6` feat(slice1): Document AI + BigQuery基盤

- [x] **インフラ (IaC):**
    - [x] `tf/modules/document_ai/` モジュール作成（Document OCRプロセッサー）
    - [x] `tf/modules/bigquery/` モジュール作成（データセット、Vertex AI接続）
    - [x] IAM権限設定（Vertex AI User、Document AI User、GCS読み取り）
- [x] **バックエンド:**
    - [x] BigQueryクライアント実装（`lib/bigquery.ts`）
    - [x] `GET /api/documents` エンドポイント実装
    - [x] `POST /api/documents/process` エンドポイント実装
- [x] **フロントエンド:**
    - [x] Documents ページ実装
    - [x] DocumentList コンポーネント実装
    - [x] ナビゲーションにDocumentsリンク追加

---

## スライス2: dbtパイプライン - DONE

**目標:** Document AIで抽出したテキストをチャンク化し、BigQueryテーブルに格納する。

- [x] **dbt:**
    - [x] dbtプロジェクト構造をセットアップ (`dbt/`)
    - [x] `stg_pdf_uploads__extracted_texts.sql` モデル実装（ML.PROCESS_DOCUMENT）
    - [x] `int_extracted_texts__chunked.sql` モデル実装（チャンク化、MD5 ID生成）
    - [x] `dim_documents.sql` モデル実装（文書メタデータ）
    - [x] `fct_document_chunks.sql` モデル実装（チャンクテーブル）
    - [x] `exp_api__documents.sql` モデル実装（Cloud Storage JSON出力）
    - [x] UUID生成マクロ、チャンク化マクロ、GCSエクスポートマクロ実装
- [x] **インフラ (IaC):**
    - [x] `tf/modules/cloud_run_job/` モジュール作成（dbt実行環境）
    - [x] dbt用Dockerイメージ作成
    - [x] CI/CD: `build_dbt` ジョブ追加
- [x] **バックエンド:**
    - [x] `POST /api/documents/process` をdbtジョブトリガーに更新
    - [x] `GET /api/documents/:id` 文書詳細API実装
    - [x] Cloud Run Job起動クライアント実装
- [x] **フロントエンド:**
    - [x] DocumentDetail ページ実装
    - [x] ChunkList コンポーネント実装
    - [x] DocumentListにdetailリンク追加

---

## スライス3: キーワード検索チャット - TODO

**目標:** シンプルなチャットUIを実装し、キーワード検索で関連テキストを返す。

- [ ] **バックエンド:**
    - [ ] `POST /api/chat` エンドポイント実装
    - [ ] BigQuery LIKE検索実装
    - [ ] インメモリセッション管理
- [ ] **フロントエンド:**
    - [ ] Chat ページ実装
    - [ ] ChatWindow コンポーネント実装
    - [ ] MessageBubble コンポーネント実装
    - [ ] ソース表示（元ドキュメントへのリンク）

---

## スライス4: ベクトル検索 + Mastra統合 - TODO

**目標:** 自然言語でのセマンティック検索を可能にし、MastraでLLMエージェントを統合する。

- [ ] **dbt:**
    - [ ] Vertex AI Embeddingモデル定義
    - [ ] `intermediate/embeddings.sql` モデル実装（ML.GENERATE_EMBEDDING）
    - [ ] `marts/core/chunks.sql` に`chunk_embedding`カラム追加
    - [ ] Vector Index作成
- [ ] **バックエンド:**
    - [ ] Mastraエージェント実装（`agents/chat.ts`）
    - [ ] vectorSearchツール実装（BigQuery VECTOR_SEARCH）
    - [ ] `POST /api/chat` をMastra統合に更新

---

## スライス5: イベント抽出 + カレンダー登録 - TODO

**目標:** PDFから予定を抽出し、ワンタップでGoogleカレンダーに登録できる機能を実装。

- [ ] **dbt:**
    - [ ] `marts/core/events.sql` モデル実装
    - [ ] `calendar_sync_history` モデル実装
    - [ ] `exports/api_events.sql` モデル実装
- [ ] **バックエンド:**
    - [ ] `GET /api/calendar/events` エンドポイント実装
    - [ ] `POST /api/calendar/sync` エンドポイント実装
    - [ ] Google Calendar API連携実装
- [ ] **フロントエンド:**
    - [ ] Events ページ実装
    - [ ] EventCard コンポーネント実装
    - [ ] 楽観的UI更新実装

---

## スライス6: 文書種別構造化 - TODO

**目標:** 各文書種別（journal, photo_album等）に特化したテーブルとビューを実装。

- [ ] **dbt:**
    - [ ] `marts/document_types/journal.sql` モデル実装
    - [ ] `marts/document_types/photo_album.sql` モデル実装
    - [ ] `marts/document_types/monthly_lunch_schedule.sql` モデル実装
    - [ ] その他の文書種別モデル実装
    - [ ] API用エクスポートモデル実装
- [ ] **バックエンド:**
    - [ ] `GET /api/documents/{type}` エンドポイント実装
- [ ] **フロントエンド:**
    - [ ] Journal ページ実装
    - [ ] LunchSchedule ページ実装

---

## 完了済みフェーズ（レガシー）

### フェーズ 0: 開発プロセスの定義 - DONE

- [x] 開発フローを `GEMINI.md` に記載する

### フェーズ 1: パイプラインの確立 (Health-Checkスライス) - DONE

- [x] devcontainer の設定整備
- [x] OpenTofuで最小限のリソースを定義
- [x] `GET /api/health` エンドポイント作成
- [x] CI/CDワークフロー構築

### フェーズ 1.5: インフラ構成のリファクタリング - DONE

- [x] OpenTofuのディレクトリ構造を再編成
- [x] Workload Identity連携に移行

### フェーズ 1.6: 開発環境の改善 - DONE

- [x] OpenTofuの実行環境を構築
