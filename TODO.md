# TODO (スライスベース計画)

このタスクリストは、小さく完全な機能スライスを継続的にデプロイしていくアジャイルなアプローチに基づいています。

---

### フェーズ 0: 開発プロセスの定義

- [x] 開発フローを `GEMINI.md` に記載する

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

### フェーズ 2: PDFメタデータ登録スライス

**目標:** PDFを処理し、その記録をDBに保存・表示する、データ処理の基本フローを完成させる。

- [ ] **インフラ (IaC):**
    - [ ] `gcs`, `cloud_function`, `document_ai`, `bigquery` の各モジュールを更新・作成し、リソースを追加する
- [ ] **バックエンド (TDD):**
    - [ ] 手動トリガーでPDFを解析し、メタデータをBigQueryに保存するCloud Functionを実装
    - [ ] 処理済みドキュメント一覧を返す `GET /api/documents` エンドポイントを実装
- [ ] **フロントエンド (TDD):**
    - [ ] `/api/documents` から取得したドキュメント一覧を表示するページを作成

---

### フェーズ 3: Google Drive連携と定期実行スライス

**目標:** Google Driveを監視し、新規ファイルを自動的に検出・処理する仕組みを構築する。

- [ ] **インフラ (IaC):**
    - [ ] `cloud_scheduler` モジュールを作成し、Cloud FunctionのIAM権限を更新する
- [ ] **バックエンド (TDD):**
    - [ ] Cloud Functionを拡張し、Schedulerによる定期実行に対応
    - [ ] Google Driveの特定フォルダをポーリングし、未処理の新規ファイルを検出して処理パイプラインに連携するロジックを実装

---

### フェーズ 4: RAGエージェント (チャット) スライス

**目標:** 蓄積されたデータに対する自然言語での問い合わせに応答するAIエージェントを実装する。

- [ ] **バックエンド (TDD):**
    - [ ] VoltAgent をセットアップ
    - [ ] BigQueryのテーブルを横断検索する `BigQuery Retriever Tool` を実装
    - [ ] `POST /api/chat` エンドポイントとセッション管理を実装
- [ ] **フロントエンド (TDD):**
    - [ ] AIと対話するためのチャットUIコンポーネントを作成し、ダッシュボードに統合

---

### フェーズ 5: カレンダーイベント抽出・表示スライス

**目標:** PDFからカレンダー登録候補となるイベントを抽出し、ユーザーに提示する。

- [ ] **インフラ (IaC):**
    - [ ] `bigquery` モジュールを更新し、`calendar_events` テーブルを追加する
- [ ] **バックエンド (TDD):**
    - [ ] PDF解析ロジックを拡張し、「予定」に関する情報を抽出して `calendar_events` テーブルに保存する機能を追加
    - [ ] `GET /api/calendar/events` エンドポイントを実装
- [ ] **フロントエンド (TDD):**
    - [ ] カレンダー登録候補のイベントをリスト表示するUIを作成

---

### フェーズ 6: カレンダーイベント承認スライス

**目標:** ユーザーが承認したイベントを実際にGoogle Calendarに登録する。

- [ ] **インフラ (IaC):**
    - [ ] `app` モジュールのサービスアカウントにGoogle Calendar APIの権限を追加する
- [ ] **バックエンド (TDD):**
    - [ ] `POST /api/calendar/events/{event_id}/approve` エンドポイントを実装
    - [ ] Google Calendar APIを呼び出してカレンダーにイベントを作成するロジックを実装
- [ ] **フロントエンド (TDD):**
    - [ ] イベントリストに「承認」ボタンを追加し、APIを呼び出す機能を実装

---

### フェーズ 7: 写真ギャラリースライス

**目標:** PDFから抽出した写真をWeb UI上で閲覧できるようにする。

- [ ] **インフラ (IaC):**
    - [ ] `bigquery` モジュールを更新し、`images` テーブルを追加する
- [ ] **バックエンド (TDD):**
    - [ ] PDF解析ロジックを拡張し、画像を抽出してCloud Storageに保存する機能を追加
    - [ ] 画像のメタデータを `images` テーブルに保存する機能を追加
    - [ ] 署名付きURLを返す `GET /api/photos` エンドポイントを実装
- [ ] **フロントエンド (TDD):**
    - [ ] 写真を一覧表示するギャラリーページを作成
�
