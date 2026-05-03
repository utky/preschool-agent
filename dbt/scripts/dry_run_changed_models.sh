#!/bin/bash
# 変更されたdbtモデル/マクロのcompiled SQLをBigQuery dry runで検証する
#
# 使用方法:
#   bash dry_run_changed_models.sh "<変更ファイル一覧（改行区切り）>"
#
# 戦略:
#   - dbt/models/ の変更 → 対応するcompiled SQLをdry run
#   - dbt/macros/ の変更 → マクロを呼び出しているモデルを特定しdry run
#                          + マクロソースをgrepでBigQuery非対応パターン検索

set -e

CHANGED_FILES="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DBT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$DBT_DIR/.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-lofilab}"
COMPILED_BASE="$DBT_DIR/target/compiled/school_agent/models"

# BigQuery非対応: 多列タプル NOT IN パターン
BAD_PATTERN='\([^)]*,[^)]*\)[[:space:]]+NOT[[:space:]]+IN'

FAILED=0
CHECKED=0

# 単一ファイルをbq dry runで検証する関数
dry_run_file() {
    local compiled_file="$1"
    local label="$2"

    if [ ! -f "$compiled_file" ]; then
        echo "  SKIP: compiled file not found: $compiled_file"
        return 0
    fi

    echo "  dry run: $label"
    local output
    if ! output=$(bq query \
        --dry_run \
        --use_legacy_sql=false \
        --project_id="$PROJECT_ID" \
        --format=none \
        < "$compiled_file" 2>&1); then
        echo "  FAILED: $label"
        echo "$output"
        return 1
    fi
    echo "  OK: $label"
    return 0
}

# モデルソースパスをcompiled パスに変換する関数
# 入力: dbt/models/intermediate/foo.sql (リポジトリルートからの相対パス)
# 出力: dbt/target/compiled/school_agent/models/intermediate/foo.sql (絶対パス)
model_to_compiled_path() {
    local src_path="$1"
    # dbt/models/ 以降のパスを抽出
    local rel_path="${src_path#dbt/models/}"
    echo "$COMPILED_BASE/$rel_path"
}

echo "=== BigQuery dry run 検証 ==="
echo "プロジェクト: $PROJECT_ID"
echo ""

# A. モデルファイルの変更を処理
MODEL_FILES=$(echo "$CHANGED_FILES" | tr ' ' '\n' | grep "^dbt/models/.*\.sql$" || true)

if [ -n "$MODEL_FILES" ]; then
    echo "[モデル] 変更されたモデルを dry run..."
    while IFS= read -r src_file; do
        [ -z "$src_file" ] && continue
        compiled_file=$(model_to_compiled_path "$src_file")
        CHECKED=$((CHECKED + 1))
        if ! dry_run_file "$compiled_file" "$src_file"; then
            FAILED=$((FAILED + 1))
        fi
    done <<< "$MODEL_FILES"
    echo ""
fi

# B. マクロファイルの変更を処理
MACRO_FILES=$(echo "$CHANGED_FILES" | tr ' ' '\n' | grep "^dbt/macros/.*\.sql$" || true)

if [ -n "$MACRO_FILES" ]; then
    echo "[マクロ] 変更されたマクロを解析..."
    while IFS= read -r macro_file; do
        [ -z "$macro_file" ] && continue
        echo "  マクロファイル: $macro_file"

        # マクロ名を抽出 ({% macro name( の形式)
        macro_name=$(grep -o 'macro [a-zA-Z_][a-zA-Z0-9_]*' "$REPO_DIR/$macro_file" 2>/dev/null | sed 's/macro //' | head -1 || true)
        if [ -z "$macro_name" ]; then
            echo "  SKIP: マクロ名を抽出できませんでした"
            continue
        fi
        echo "  マクロ名: $macro_name"

        # ① ソースgrepでBigQuery非対応パターンを直接検索
        echo "  ソース grep 検証中..."
        grep_result=$(grep -En "$BAD_PATTERN" "$REPO_DIR/$macro_file" || true)
        if [ -n "$grep_result" ]; then
            echo "  FAILED: BigQuery非対応の多列タプル NOT IN を検出:"
            echo "$grep_result"
            echo "  修正: NOT IN を NOT EXISTS に変換してください"
            FAILED=$((FAILED + 1))
        else
            echo "  OK: ソースgrepでパターン検出なし"
        fi

        # ② マクロを呼び出しているモデルを特定してdry run
        calling_models=$(grep -rl "{{ *${macro_name}(" "$DBT_DIR/models/" --include="*.sql" 2>/dev/null || true)
        if [ -z "$calling_models" ]; then
            echo "  INFO: このマクロを呼び出しているモデルが見つかりませんでした"
            continue
        fi

        echo "  呼び出しモデル dry run..."
        while IFS= read -r model_abs; do
            [ -z "$model_abs" ] && continue
            # 絶対パスをリポジトリルートからの相対パスに変換
            model_rel="${model_abs#$REPO_DIR/}"
            compiled_file=$(model_to_compiled_path "$model_rel")
            CHECKED=$((CHECKED + 1))
            if ! dry_run_file "$compiled_file" "$model_rel"; then
                FAILED=$((FAILED + 1))
            fi
        done <<< "$calling_models"
    done <<< "$MACRO_FILES"
    echo ""
fi

# 検証対象がなかった場合
if [ "$CHECKED" -eq 0 ] && [ -z "$MACRO_FILES" ]; then
    echo "検証対象のdbtファイル変更なし、dry run スキップ"
    exit 0
fi

# 結果サマリー
if [ "$FAILED" -ne 0 ]; then
    echo "=== 結果: $FAILED 件の dry run が失敗しました ==="
    exit 1
fi

echo "=== 結果: 全ての dry run が成功しました ==="
exit 0
