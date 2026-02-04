#!/bin/bash
# Stop hook: Claude Code応答完了時にテストを実行

set -e

# 入力JSONを読み取り
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')

cd "$CWD"

# 変更されたファイルを検出
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || echo "")
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only --staged 2>/dev/null || echo "")
fi

# 変更がない場合はスキップ
if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# frontend/の変更を検出
if echo "$CHANGED_FILES" | grep -q "^frontend/"; then
  if [ -f "frontend/package.json" ] && grep -q '"test"' frontend/package.json; then
    echo "Running frontend tests..."
    if ! (cd frontend && npm run test 2>&1); then
      echo '{"decision": "block", "reason": "フロントエンドのテストが失敗しました。テストを修正してください。"}'
      exit 0
    fi
  fi
fi

# backend/の変更を検出
if echo "$CHANGED_FILES" | grep -q "^backend/"; then
  if [ -f "backend/package.json" ] && grep -q '"test"' backend/package.json; then
    echo "Running backend tests..."
    if ! (cd backend && npm run test 2>&1); then
      echo '{"decision": "block", "reason": "バックエンドのテストが失敗しました。テストを修正してください。"}'
      exit 0
    fi
  fi
fi

# tf/の変更を検出
if echo "$CHANGED_FILES" | grep -q "^tf/"; then
  echo "Running OpenTofu validation..."
  if ! tofu -chdir=tf/environments/production/ validate 2>&1; then
    echo '{"decision": "block", "reason": "OpenTofu validateが失敗しました。設定を修正してください。"}'
    exit 0
  fi
fi

# gas/の変更を検出
if echo "$CHANGED_FILES" | grep -q "^gas/"; then
  if [ -f "gas/package.json" ] && grep -q '"test"' gas/package.json; then
    echo "Running GAS tests..."
    if ! (cd gas && npm run test 2>&1); then
      echo '{"decision": "block", "reason": "GASのテストが失敗しました。テストを修正してください。"}'
      exit 0
    fi
  fi
fi

# すべてのテストがパス
exit 0
