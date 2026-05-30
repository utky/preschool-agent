# ADR-001: Next.js → Vite + React + Hono + Mastra 移行

## Status
Accepted

## Context

初期実装はNext.js 15で行われていたが、設計方針（Hono + Vite + Cloud Run + Cloud Storage配信）と乖離が生じていた。
Next.jsはCloud Runへのデプロイが可能だが、静的ファイルのCloud Storage直接配信・Honoを使ったAPIの軽量化・Mastraとの統合といった設計目標と相性が悪かった。
また、Cloud Load Balancerを必要とするNext.jsのSSR構成はコスト面でも不利だった（月額$18〜）。

## Decision

プランC改として以下の構成に移行する：
- フロントエンド: Vite + React + Tailwind CSS → Cloud Storage (public) で直接配信
- バックエンド: Hono（Cloud Run）が `GET /` で `index.html` を配信し、API (`/api/*`) を処理
- AIエージェント: Mastra をバックエンドに統合
- Cloud Load Balancer を使用しない（コスト削減）

静的ファイル（JS/CSS）はCloud StorageのURLを直接参照し、バックエンドはindex.htmlのみ担当する構成。

## Consequences

**得られるもの**:
- 設計書との完全な整合性
- Cloud Load Balancer廃止でコスト削減（月額$18〜）
- Honoの軽量性によるコールドスタート短縮
- Mastraとの統合が自然な形で実現

**失うもの / トレードオフ**:
- 移行期間中（スライス0, 3-4週間）はユーザー価値ゼロ
- SSR不可（フルSPA構成）
- SEOは考慮しない（社内限定アプリのため問題なし）
