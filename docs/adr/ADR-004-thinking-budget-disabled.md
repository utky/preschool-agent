# ADR-004: Gemini Thinking モード無効化（thinkingBudget: 0）

## Status
Accepted

## Context

Gemini 2.5 Flash の Thinking モードはThinkingトークンが通常トークンの約5倍のコストになる。
2026-03-06〜03-10 にかけて `thinkingBudget` 設定漏れにより1日¥80〜95のコスト増が発生した。

PDF構造化抽出（OCR、イベント情報抽出、メタデータ抽出）は本質的に決定論的なタスクであり、
複雑な推論（Thinking）による精度向上の恩恵が少ないと判断した。

## Decision

`ML.GENERATE_TEXT` を使用するすべてのdbtモデル（`stg_pdf_uploads__extracted_texts`, `fct_events`, `dim_documents` 等）の `model_params` に以下を必須設定する：

```json
"thinkingConfig": {
  "thinkingBudget": 0
}
```

また、`.claude/rules/thinking-budget.md` に自動チェックルールを設定し、
PostToolUseフックで `thinkingBudget != 0` を検出してブロックする。

## Consequences

**得られるもの**:
- ML.GENERATE_TEXT コストを5分の1に削減
- PostToolUseフックによる設定漏れの自動防止

**失うもの / トレードオフ**:
- 複雑な文書構造に対して推論精度が若干低下する可能性がある
- 将来的にThinkingが有効な複雑なタスクを追加する場合は個別にADRで再検討が必要
