# ルール: ファイル編集後のLinter実行

## 概要

TypeScript・Terraform・SQLファイルを編集した後は、必ずLinterを実行すること。
PostToolUseフック（`.claude/hooks/run-linter.sh`）が自動でLinterを実行し、
エラーがある場合はClaudeの応答をブロックする。

---

## 各ファイル種別のLinter

### TypeScript / TSX（`.ts`, `.tsx`）

```bash
# frontend
cd frontend && npx eslint <file_path>

# backend
cd backend && npx eslint <file_path>

# gas
cd gas && npx eslint <file_path>
```

- ESLintエラーがある場合は修正してから次に進む
- `// eslint-disable` コメントによる無効化は原則禁止

### Terraform（`.tf`）

```bash
tofu fmt <directory>
```

- `tofu fmt` でフォーマットを自動適用する
- フォーマット差分がある場合はブロックされる

### SQL（`.sql`）

```bash
sqlfluff lint <file_path>
```

- BigQuery + dbt テンプレーターで lint する
- 設定ファイル: `dbt/.sqlfluff`
- 違反がある場合は修正してから次に進む

---

## フック設定

PostToolUseフックが Edit / Write ツール使用後に自動実行される。
手動でLinterを実行する必要はないが、エラー時は必ず修正すること。
