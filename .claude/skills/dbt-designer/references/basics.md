# 共通原則（全レイヤ共通のガイドライン）

dbt 公式ドキュメント（best-practices guide overview）から抽出。

## 3レイヤアーキテクチャ

```
sources → staging → intermediate → marts
```

- **staging**: ソースconformed。生データを atomic な building block に変換
- **intermediate**: ビジネスconformed への変換の橋渡し
- **marts**: エンドユーザー向けの最終成果物

各レイヤは一方向に依存する（downstream は upstream を参照するが逆はない）。

## 一貫性が最重要

- 規約から外れる場合は理由をコードコメントで明記する
- チーム全員が同じ命名・構造パターンを使う

## DRY原則

- 変換ロジックは一箇所にのみ存在させる
- downstream モデルで同じロジックを再定義しない
- 同じ変換が複数箇所に必要になったら intermediate または macro に切り出す

## モジュラリティ

- 各モデルは単一責務を持つ
- モデルが複数の異なる目的を果たしている場合は分割を検討する

## YAML設定方針

- フォルダごとに `_[dir]__models.yml` を作成
- staging には `_[dir]__sources.yml` も作成
- ファイル名の先頭アンダースコアでファイルがソート上位に来る
- 例: `dbt/models/staging/google_drive/_google_drive__sources.yml`

## フォルダをセレクタとして使う

```bash
dbt build --select staging.google_drive+
dbt build --select marts.core+
dbt build --select exports+
```

フォルダ単位でビルドできるように構造を設計する。

## ref() の使用

- 常に `ref()` でモデルを参照する（直接テーブル名を書かない）
- ソースは `source()` で参照する
- `ref()` と `source()` 以外のテーブル参照は禁止

## マテリアライゼーションのデフォルト

| レイヤ | デフォルト | 理由 |
|--------|-----------|------|
| staging | view | ストレージ節約、常に最新 |
| intermediate | ephemeral | ウェアハウスに余分なテーブルを作らない |
| marts | table / incremental | クエリパフォーマンス優先 |
| exports | table | GCSエクスポート前提 |
