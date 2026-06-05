# ADR-005: WordPressクローラー（REST API → GCS）への移行

## Status
Accepted

## Context

当初、PDF取り込みはGoogle Drive → GCS（Google Apps Script経由、スライス7）で実装した。
しかし以下の問題があった：
- 学校がWordPress（`https://tatibana.ed.jp/youtien/announce/`）でPDFを公開しており、Drive経由では手動アップロードが必要
- 自動化のためにはWordPressの更新を直接検知する方が確実

WordPress REST APIが利用可能であることを確認し、直接クローリングに移行した（スライス8, 2026-03-30）。

**移行後の後処理（2026-03-30）**:
GAS（Drive）とクローラーの二系統混在期間に `document_id` NULL問題が発生。
`stg_pdf_uploads__extracted_texts.sql` で `COALESCE(media-id, drive-file-id)` に変更し、
Drive重複ファイル29件削除・固有ファイル3件のメタデータ付与・クローラー全件再実行で解消。

## Decision

Cloud Run Job（`crawler/`パッケージ）がWordPress REST APIをポーリングし、新着PDFをGCSの `web/` プレフィックスに保存する。
Cloud Scheduler → Cloud Workflows の最初のステップとして組み込み（STEP1: クローラー → STEP2: dbt）。

GCSパス: `web/{YYYY}/{MM}/{media_id}_{sanitized_title}.pdf`

メタデータ（dbtとの互換性）:
- `x-goog-meta-media-id`: WordPress media ID
- `x-goog-meta-letter-id`: letter post ID
- `x-goog-meta-source-url`: WordPress PDFの元URL
- `x-goog-meta-modified_gmt`: WordPress文書更新日時（UTC）

同一投稿に複数PDFがある場合は `modified_gmt` が最新のものを採用（訂正版対応）。

**`@google-cloud/storage` v7.x の注意点**: カスタムメタデータは二重ネスト構造が必要（`{ metadata: { contentType, metadata: { ... } } }`）。

## Consequences

**得られるもの**:
- PDF取り込みの完全自動化
- GAS/Drive依存の解消
- WordPress更新時の即時検知（6時間以内）

**失うもの / トレードオフ**:
- WordPressのURL変更・API仕様変更に対する脆弱性
- GAS（Drive連携）はクローラー移行完了後に削除済み（2026-06-05）
