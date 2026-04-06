# ルール: dbt モデルの thinkingBudget は必ず 0 に設定する

## 理由

Gemini 2.5 Flash の Thinking モードは通常トークンの約5倍のコストがかかる。
過去に thinkingBudget の設定漏れで1日¥80〜95のコスト増が発生した（2026-03-06〜03-10）。

## 必須事項

dbt モデル（`dbt/models/**/*.sql`）の ML.GENERATE_TEXT / ML.GENERATE_EMBEDDING の
`model_params` または `generationConfig` に `thinkingConfig` を含める場合は、
必ず `"thinkingBudget": 0` を設定すること。

## NG 例

```sql
"thinkingConfig": {
  "thinkingBudget": 1024  -- NG: コストが5倍になる
}
```

## OK 例

```sql
"thinkingConfig": {
  "thinkingBudget": 0  -- OK: Thinking 無効
}
```

## 自動チェック

PostToolUse フック（`.claude/hooks/run-linter.sh`）が thinkingBudget != 0 を自動検出してブロックする。
