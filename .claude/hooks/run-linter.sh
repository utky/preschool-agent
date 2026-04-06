#!/bin/bash
# PostToolUse hook: Edit/Write ツール使用後に自動でLinterを実行

set -e

# 入力JSONを読み取り
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# ファイルパスが取得できない場合はスキップ
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# ファイルが存在しない場合はスキップ
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# 拡張子を取得
EXT="${FILE_PATH##*.}"

# JSONブロックメッセージを出力して終了するヘルパー関数
block_with_reason() {
  local reason="$1"
  jq -n --arg reason "$reason" '{"decision": "block", "reason": $reason}'
  exit 0
}

# TypeScript / TSX ファイル
if [ "$EXT" = "ts" ] || [ "$EXT" = "tsx" ]; then
  # workspace を判定
  if echo "$FILE_PATH" | grep -q "/frontend/"; then
    WORKSPACE_DIR=$(echo "$FILE_PATH" | sed 's|/frontend/.*|/frontend|')
  elif echo "$FILE_PATH" | grep -q "/backend/"; then
    WORKSPACE_DIR=$(echo "$FILE_PATH" | sed 's|/backend/.*|/backend|')
  elif echo "$FILE_PATH" | grep -q "/gas/"; then
    WORKSPACE_DIR=$(echo "$FILE_PATH" | sed 's|/gas/.*|/gas|')
  else
    # workspace が判定できない場合はスキップ
    exit 0
  fi

  # eslint を実行
  LINT_OUTPUT=$(cd "$WORKSPACE_DIR" && npx eslint "$FILE_PATH" 2>&1) || LINT_EXIT=$?
  if [ "${LINT_EXIT:-0}" -ne 0 ]; then
    block_with_reason "ESLintエラーがあります。修正してください。

${LINT_OUTPUT}"
  fi
fi

# Terraform ファイル
if [ "$EXT" = "tf" ]; then
  DIR=$(dirname "$FILE_PATH")
  FMT_OUTPUT=$(tofu fmt -check "$DIR" 2>&1) || FMT_EXIT=$?
  if [ "${FMT_EXIT:-0}" -ne 0 ]; then
    # フォーマットを自動適用（stderr に出力してstdoutを汚さない）
    tofu fmt "$DIR" >&2 2>&1
    block_with_reason "tofu fmt を実行してフォーマットを自動修正しました。変更を確認してください。

フォーマット対象: ${FMT_OUTPUT}"
  fi
fi

# SQL ファイル
if [ "$EXT" = "sql" ]; then
  # sqlfluff がインストールされていない場合はスキップ
  if ! command -v sqlfluff >/dev/null 2>&1; then
    exit 0
  fi

  LINT_OUTPUT=$(sqlfluff lint --config "${CLAUDE_PROJECT_DIR}/dbt/.sqlfluff" "$FILE_PATH" 2>&1) || LINT_EXIT=$?
  if [ "${LINT_EXIT:-0}" -ne 0 ]; then
    block_with_reason "SQLfluffエラーがあります。修正してください。

${LINT_OUTPUT}"
  fi

  # dbt モデルの thinkingBudget が 0 以外に設定されていないかチェック
  if echo "$FILE_PATH" | grep -q "/dbt/models/"; then
    THINKING_LINES=$(grep -n '"thinkingBudget"' "$FILE_PATH" 2>/dev/null || true)
    if [ -n "$THINKING_LINES" ]; then
      NON_ZERO=$(echo "$THINKING_LINES" | grep -v '"thinkingBudget": 0' || true)
      if [ -n "$NON_ZERO" ]; then
        block_with_reason "thinkingBudget が 0 以外の値に設定されています。
Vertex AI コスト削減のため thinkingBudget: 0 を使用してください。

問題の箇所:
${NON_ZERO}

参考: .claude/rules/thinking-budget.md"
      fi
    fi
  fi
fi

# Linterパス
exit 0
