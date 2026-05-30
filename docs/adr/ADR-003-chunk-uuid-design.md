# ADR-003: チャンク識別にUUID v4採用 + RAG用冗長メタデータ

## Status
Accepted

## Context

BigQuery Vector Index は `ARRAY<STRUCT>` 内のベクトルにインデックスを作成できないため、
1チャンク = 1レコード構造が必須となった。このとき、チャンクの一意識別子の設計が必要となった。

候補：
- 連番（`document_id + chunk_index`）: シンプルだが、チャンク分割アルゴリズム変更時に全レコードの再生成が必要
- UUID v4: アルゴリズム変更に無関係な安定したID ← 採用

また、Vector Search時のJOINコストを避けるため、`document_chunks`テーブルへのメタデータ冗長保存を決定した。

## Decision

- `chunk_id`: UUID v4（アルゴリズム変更・バックフィル時も既存IDは不変）
- `document_chunks`テーブルに`document_type`, `title`, `publish_date`を冗長保存
  - Vector Search時にJOINなしでフィルタリング可能
  - パーティションpruningとクラスタリングの恩恵を最大化

クラスタリング順序: `document_type`（低カーディナリティ）→ `document_id` → `chunk_id`

## Consequences

**得られるもの**:
- チャンク分割ロジック変更時も既存IDが不変でトレーサビリティ保持
- Vector Search時のJOIN不要でクエリが高速
- パーティションpruning効果が高い

**失うもの / トレードオフ**:
- `document_chunks`テーブルにメタデータ重複（`documents`テーブルと同じ情報が2カ所に存在）
- メタデータ更新時は両テーブルを更新する必要がある（dbtのfull-refreshで対応）
