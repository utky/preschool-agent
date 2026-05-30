# 設計書

このドキュメントは `requirements.md` に基づくシステム設計を定義します。

## 現状の設計（design/）

- [1. アーキテクチャ概要](./design/01_architecture.md)
- [2. PDF解析パイプライン](./design/02_pdf_parsing.md)
- [3. プロジェクト構成](./design/03_project_structure.md)
- [4. サーバーサイド設計](./design/04_server_side_design.md)
- [6. APIエンドポイント設計](./design/06_api_design.md)
- [7. フロントエンド設計](./design/07_frontend_design.md)
- [8. インフラストラクチャ (IaC)](./design/08_infrastructure.md)
- [9. CI/CD](./design/09_ci_cd.md)
- [10. 認証・認可](./design/10_authentication.md)
- [11. RAGエージェント設計 (Mastra)](./design/11_rag_agent.md)
- [12. ユニットテスト設計](./design/12_unit_test.md)
- [13. shared-typesパッケージ設計](./design/13_shared_types.md)
- [スライス一覧・アーキテクチャ決定](./design/10_slice_plan.md)

## 意思決定の記録（adr/）

設計上の意思決定はADR（Architecture Decision Records）として記録する。

- [ADR-001: Next.js → Vite+React+Hono+Mastra移行](./adr/ADR-001-architecture-migration.md)
- [ADR-002: PDF解析にBigQuery ML.GENERATE_TEXT採用](./adr/ADR-002-pdf-parsing-bigquery-gemini.md)
- [ADR-003: チャンク識別にUUID v4採用](./adr/ADR-003-chunk-uuid-design.md)
- [ADR-004: Thinking無効化（thinkingBudget: 0）](./adr/ADR-004-thinking-budget-disabled.md)
- [ADR-005: WordPressクローラーへの移行](./adr/ADR-005-wordpress-crawler.md)
