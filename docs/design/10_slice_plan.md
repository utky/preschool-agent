# スライス計画（プランC改）- 完了状態

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Vite + React + Tailwind CSS（Cloud Storage配信） |
| バックエンド | Hono（Cloud Run）+ Mastra |
| PDF取得 | WordPress REST APIクローラー（Cloud Run Job）|
| データパイプライン | dbt + BigQuery ML.GENERATE_TEXT（Gemini 2.5 Flash） |
| ベクトル検索 | BigQuery Vector Index（COSINE IVF） |
| インフラ | OpenTofu、Cloud Storage（フロントエンド）、Secret Manager |
| CI/CD | GitHub Actions |

アーキテクチャ上の意思決定 → [docs/adr/](../adr/)

## スライス一覧

| # | 内容 | 状態 |
|---|---|---|
| 0 | アーキテクチャ移行（Next.js → Vite + Hono + Mastra） | DONE |
| 7 | Google Drive → GCS自動連携（GAS） | DONE |
| 1 | BigQuery基盤（Object Table + ML.GENERATE_TEXT） | DONE |
| 2 | dbtパイプライン（チャンク化・埋め込み・エクスポート） | DONE |
| 3 | キーワード検索チャット | DONE |
| 4 | ベクトル検索 + Mastra統合 | DONE |
| 5 | イベント抽出 + カレンダー登録 | DONE |
| 8 | Webクローリング（WordPress REST API → GCS） | DONE |
| 6 | 文書種別構造化（縮小版） | DONE |

## 主要アーキテクチャ決定

### 低コストインフラ

Cloud Load Balancer不使用。バックエンド（Hono）が `GET /` で `index.html` を配信し、
静的ファイル（JS/CSS）は Cloud Storage（public）から直接配信する。

```
ユーザー → Cloud Run (Hono) → index.html
         → storage.googleapis.com/school-agent-prod-frontend/assets/*.js
```

### APIレスポンス最適化（dbt → Cloud Storage → API）

BigQueryへの直接クエリを排除。dbt完了時にJSONをCloud Storageに出力し、APIはそれを返す。

```
dbt run → BigQuery → EXPORT DATA → Cloud Storage (JSON)
                                        ↓
                               Hono API がJSONを返却
```

対象: `/api/documents` → `documents.json` / `/api/calendar/events` → `events.json`

### dbt実行スケジュール

Cloud Scheduler `0 0,6,12,18 * * *`（JST 0/6/12/18時）。
処理範囲は `start_datetime`/`end_datetime` 変数（6時間幅）で制御。
