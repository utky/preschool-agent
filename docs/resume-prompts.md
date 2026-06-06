# 再開用プロンプト集

各worktreeの続きを始めるときにそのままコピーして使う。

---

## 2. immutable-wondering-kettle — PDFパイプライン課題2 バグ修正実装

**状態**: 設計書への方針追記済み、実装がまだ

```
以下のworktreeで作業を再開してほしい。

## Worktree情報
- ブランチ: worktree-immutable-wondering-kettle
- パス: /workspaces/preschool-agent/.claude/worktrees/immutable-wondering-kettle
- 対応planファイル: なし（設計書に方針が記載されている）

## 完了済み
コミット 0f7fb9c にて docs/design/10_slice_plan.md を更新済み:
- crawler/main.ts のエラー耐性向上方針（try/catch）を追記
- fetchLetters のタイムゾーンバッファ方針（仮説C）を追記

## 残タスク
docs/design/10_slice_plan.md に記載された方針に従い、実装を進める。

主な実装対象:
1. worktreeのパスに移動（EnterWorktreeまたはcdで切り替え）
2. docs/design/10_slice_plan.md を読んで方針の詳細を確認する
3. crawler/main.ts にエラー耐性のtry/catchを追加する（TDDワークフローに従う）
4. fetchLetters のタイムゾーンバッファ修正（仮説C）を実装する
5. テスト全通過を確認してコミット・PR作成
```

---

## 4. stateful-squishing-pebble — npm パッケージ メジャーアップデート（残り全件）

**状態**: 実装未着手（planファイルに詳細な実施計画あり）

```
以下のworktreeで作業を再開してほしい。

## Worktree情報
- ブランチ: worktree-stateful-squishing-pebble
- パス: /workspaces/preschool-agent/.claude/worktrees/stateful-squishing-pebble
- 対応planファイル: /home/node/.claude/plans/stateful-squishing-pebble.md

## 背景
TODO.md の「npmパッケージ メジャーアップデート（個別対応）」セクションに未完了の
アップデートが残っている。一部は脆弱性修正を含むため優先対応が必要。

## 残タスク（TODO.md 未チェック）
- @hono/node-server v1 → v2（HIGH脆弱性 GHSA-wc8c-qw6v-h7f6・最優先）
- zod v3 → v4（backend）
- pino v9 → v10（backend）
- concurrently v9 → v10（root）
- @types/node v22 → v25（backend devDep）
- @google-cloud/bigquery v7 → v8（backend）
- @googleapis/calendar v14 → v15（backend）
- google-auth-library v9 → v10（backend）
- globals v15 → v17（frontend devDep）
- jsdom v26 → v29（frontend devDep）

## 実施手順
planファイル /home/node/.claude/plans/stateful-squishing-pebble.md に
Group A/B/C の分類・各パッケージの影響範囲・手順が詳細に記載されているので、
それに従って実施すること。

大まかな流れ:
1. worktreeのパスに移動（EnterWorktreeまたはcdで切り替え）
2. TODO.md で @hono/node-server のチェック漏れを修正（コード変更不要、確認のみ）
3. Group A（package.json版号変更のみ）を一括更新 → npm install
4. Group B（pino/zod: 軽微確認必要）を更新 → テスト確認
5. Group C（@google-cloud/bigquery: 動作確認必須）を更新 → ビルド＋テスト確認
6. 全体: npm run build → npm run test
7. TODO.md を全件チェック済みに更新してコミット・PR作成
```
