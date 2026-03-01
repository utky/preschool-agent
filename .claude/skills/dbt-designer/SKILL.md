---
name: dbt-designer
description: dbtモデルの追加・更新時に利用するスキル。dbt公式ベストプラクティスとプロジェクト規約に従い、モデルの配置・命名・マテリアライゼーション・責務を設計・レビューする。
allowed-tools: Read, Grep, Glob
---

# dbt Designer スキル

## 手順

1. `references/` 配下の参考資料をすべて Read する:
   - `.claude/skills/dbt-designer/references/basics.md`
   - `.claude/skills/dbt-designer/references/staging.md`
   - `.claude/skills/dbt-designer/references/intermediate.md`
   - `.claude/skills/dbt-designer/references/marts.md`
   - `.claude/skills/dbt-designer/references/exports.md`
   - `.claude/skills/dbt-designer/references/tests.md`
   - `.claude/skills/dbt-designer/references/macros.md`
   - `.claude/skills/dbt-designer/references/other.md`

2. `$ARGUMENTS` の要件・背景を理解する（未指定時は変更差分から推測）

3. 現在のモデル構成を Glob/Grep で確認する:
   - `dbt/models/**/*.sql` で全モデルを把握
   - 関連する `_*.yml` ファイルも確認

4. 以下の観点でレビュー/設計プランを出力する:
   - **配置レイヤ**: staging / intermediate / marts/core / exports のどれか
   - **ファイル名**: 命名規則に準拠しているか
   - **マテリアライゼーション**: 推奨との差異
   - **レイヤ責務**: 不適切な join/集計/ビジネスロジックの混在がないか
   - **YAMLスキーマ**: 対応する `_*.yml` への追記が必要か

5. 問題があれば「違反点 → 修正案」を具体的に示す

6. 新規設計の場合はモデルの骨格 SQL と YAML スキーマを提示する

## 出力フォーマット

```
## 設計レビュー

### 配置レイヤ
### ファイル名
### マテリアライゼーション
### レイヤ責務
### YAMLスキーマ

## 判定: 承認 / 要修正

## 修正案（要修正の場合）
```
