---
name: doc-sync
description: 実装とドキュメントの乖離を検出し修正案を提示する。スライス完了後に実行して設計書を最新の状態に保つ。
allowed-tools: Read, Grep, Glob, Bash, Edit
---

# doc-sync: 実装とドキュメントの同期スキル

## 概要

`/doc-sync [スコープ]` を実行すると、実装とドキュメントの乖離を検出して修正する。

- **引数なし**: 全体を対象にスキャン
- **引数あり** (例: `slice5`, `dbt`, `frontend`): 指定スコープに絞ってスキャン

---

## 手順

### Step 1: スコープ確認

`$ARGUMENTS` を確認する。未指定の場合は全体を対象とする。

### Step 2: 実装の現状スキャン

以下を Glob/Grep で確認する:

**dbt モデル**:
```bash
ls dbt/models/staging/
ls dbt/models/intermediate/
ls dbt/models/marts/core/
ls dbt/models/exports/
```

**バックエンド routes**:
```bash
ls backend/src/routes/
ls backend/src/agents/
ls backend/src/agents/tools/
```

**フロントエンド pages/components**:
```bash
ls frontend/src/pages/
ls frontend/src/components/events/
ls frontend/src/components/documents/
ls frontend/src/components/chat/
```

**インフラ**:
```bash
ls tf/modules/
ls tf/environments/
```

### Step 3: 設計書の読み込み

対象スコープの設計書を Read ツールで読む:

- `docs/design/03_project_structure.md` - プロジェクト構造
- `docs/design/06_api_design.md` - API設計
- `docs/design/07_frontend_design.md` - フロントエンド設計
- `docs/design/10_slice_plan.md` - スライス計画（モデル名・ファイル名参照）

### Step 4: 乖離レポートの作成

以下のカテゴリで乖離を分類して報告する:

#### カテゴリA: 記載あり・未実装（削除または「未実装」明記が必要）
- 設計書に記載されているが実装ファイルが存在しない
- 優先度: **高**（誤解を招く）

#### カテゴリB: 実装済み・未記載（設計書への追記が必要）
- 実装ファイルが存在するが設計書に記載がない
- 優先度: **中**（ドキュメントの不完全さ）

#### カテゴリC: 名称不一致（実装名に合わせた更新が必要）
- ファイル名・モデル名・API名が設計書と異なる
- 優先度: **高**（混乱を招く）

#### カテゴリD: 軽微な不整合（任意で修正）
- コメントの古い記述、廃止済み情報など
- 優先度: **低**

### Step 5: レポートの提示

以下の形式でレポートを出力する:

```
## ドキュメント乖離レポート

### [高] カテゴリC: 名称不一致
- docs/design/10_slice_plan.md: `chunks.sql` → 実装名は `fct_document_chunks.sql`

### [高] カテゴリA: 記載あり・未実装
- docs/design/07_frontend_design.md: `Gallery.tsx` が記載されているが未実装

### [中] カテゴリB: 実装済み・未記載
- docs/design/07_frontend_design.md: `DocumentDetail.tsx` が未記載

### [低] カテゴリD: 軽微な不整合
（なし）

---
修正対象: X件（高: N, 中: N, 低: N）
```

### Step 6: ユーザー承認の取得

乖離レポートを提示した後、修正してよいか確認する:

```
上記の乖離を修正しますか？（高優先度のみ / すべて / キャンセル）
```

### Step 7: 設計書の自動修正

承認後、Edit ツールで設計書を修正する。

修正方針:
- **カテゴリA**: 「未実装 / スコープ外」と明記するか削除
- **カテゴリB**: 実装済みの内容を追記
- **カテゴリC**: 実装名に合わせて更新
- **カテゴリD**: 軽微な修正または削除

### Step 8: 再スキャンして確認

修正後、再度スキャンして「乖離なし」であることを確認する。

---

## 注意事項

- 設計書を更新する際は実装を正として扱う（設計書が古い場合が多い）
- ただしスライスの「目標」「戦略」など計画的な記述は変更しない
- `DONE` マークのついたスライスの「設計書との差分」セクションは正確な記録として保持する
