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
| 1 | BigQuery基盤（Object Table + ML.GENERATE_TEXT） | DONE |
| 2 | dbtパイプライン（チャンク化・埋め込み・エクスポート） | DONE |
| 3 | キーワード検索チャット | DONE |
| 4 | ベクトル検索 + Mastra統合 | DONE |
| 5 | イベント抽出 + カレンダー登録 | DONE |
| 8 | Webクローリング（WordPress REST API → GCS） | DONE |
| 6 | 文書種別構造化（縮小版） | DONE |
| 9 | チャットUI → エージェンティックサーチ再構築 | DONE |

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

---

## バグ修正: PDFパイプライン課題2 — 4/17発行ファイル未取り込み（2026-04-17判明）

### 症状

WordPress ID 2866, 2865, 2861（2026-04-17発行）が
`gs://school-agent-lofilab-pdf-uploads/web/2026/04/` に存在しない。

### 根本原因の仮説

- **仮説A**: スケジューラーが未実行（タイミング問題）→ 手動バックフィルで解消
- **仮説B**: Cloud Run Job のデプロイ失敗またはエラー終了
- **仮説C**: WordPress API の `modified_after` パラメータをJST時刻で比較 → **実測で偽と判明（2026-06-06）、対応不要**
  - 検証: `modified_after=2026-06-05T08:25:00Z` で id=2956（modified_gmt=08:26:28）が取得できること、`modified_after=2026-06-05T08:28:00Z` では空配列になることを確認。UTC で正しく比較されている。

### 実装済み修正

#### 修正1: エラー耐性向上（`crawler/src/main.ts`）

1ファイルのダウンロード失敗でジョブ全体が停止する問題を修正。
for ループ内に try/catch を追加し、失敗した場合も残りのファイルを継続処理する。
ループ完了後にエラー件数があれば `process.exit(1)` で異常終了を記録する。

`crawler/src/types.ts` の `UploadResult` に `error?: boolean` フィールドを追加。

#### 修正2: deduplicateAttachments 廃止（`crawler/src/main.ts`, `crawler/src/wordpress.ts`）

`deduplicateAttachments`（タイトルベース重複排除）を廃止し、`selectLatestAttachment`（最新1件選択）に切り替え。
同一投稿に複数PDFが存在する場合、`modified_gmt` が最新のものを採用する。
