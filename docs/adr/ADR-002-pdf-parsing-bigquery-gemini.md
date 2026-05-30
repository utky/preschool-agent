# ADR-002: PDF解析にBigQuery ML.GENERATE_TEXT（Gemini 2.5 Flash）採用

## Status
Accepted

## Context

幼稚園PDFから構造化データ（イベント情報、文書メタデータ、チャンク）を抽出する手段を選定する必要があった。
当初はGoogle Document AIによるOCR + 後段のLLM処理を検討していたが、BigQuery MLがGemini経由でPDFの直接処理をサポートしており、パイプラインを一本化できることが判明した。

検討した選択肢：
- Google Document AI OCR + 別途LLM処理
- BigQuery ML.GENERATE_TEXT（Gemini 2.5 Flash）でPDFをワンステップ処理 ← 採用

## Decision

BigQuery `ML.GENERATE_TEXT`（Gemini 2.5 Flash）でGCSのPDFを直接入力し、OCR・テキスト抽出・構造化をワンステップで実行する。

主要な設計方針：
- 1チャンク = 1レコード（BigQuery Vector Index制約に対応）
- 中間テーブル（`stg_pdf_uploads__extracted_texts`）を保存して再実行コストを回避
- STRUCT型を採用（JSON型より型安全性・クエリ可読性・dbt管理が優れる）
- テキストデータの重複は許容（ストレージコスト年間1.2MB程度）
- 増分処理：新規ファイルのみ処理、incremental_strategy='merge' でUPSERT

## Consequences

**得られるもの**:
- Document AIプロセッサー管理が不要
- BigQueryネイティブでパイプラインが完結（GCS → BigQuery → API）
- Geminiの高精度OCRで日本語PDFに対応
- 1ステップで構造化データ抽出まで完了

**失うもの / トレードオフ**:
- BigQueryリージョン（asia-northeast1）に処理が集中
- ML.GENERATE_TEXTは処理コストがかかる（対策: 増分処理で再実行を最小化）
- Geminiモデルバージョン更新時に出力形式が変わるリスク
