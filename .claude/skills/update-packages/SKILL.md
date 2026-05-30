---
name: update-packages
description: npmパッケージを安全にアップデートする。セキュリティ監査 → バージョン差分確認 → 段階的適用（パッチ自動・マイナー確認・メジャー除外）→ テスト検証の順に実行。サプライチェーン攻撃対策を組み込んだ安全なアップデートワークフロー。
allowed-tools: Bash, Read, Edit
---

# update-packages: パッケージ安全アップデートスキル

## 概要

`/update-packages` を実行すると、npmワークスペースのパッケージを安全な手順でアップデートする。

- **対象**: `frontend/`, `backend/`, `crawler/`（npmワークスペース管理下）
- **除外**: `gas/`（レガシー・CI未カバーのため対象外）

---

## 安全方針

| 更新種別 | 方針 | 理由 |
|---------|------|------|
| **パッチ** (x.y.Z) | 自動適用 | バグ修正のみ、後方互換性あり |
| **マイナー** (x.Y.z) | 確認後適用 | 新機能追加、基本後方互換だが要確認 |
| **メジャー** (X.y.z) | **適用しない** | 破壊的変更の可能性、別途手動対応 |

---

## 手順

### Step 1: ブランチ確認

作業前にクリーンな状態であることを確認する:

```bash
git status
git stash list
```

未コミットの変更がある場合はユーザーに確認してから続ける。

### Step 2: セキュリティ監査（更新前）

既知の脆弱性とパッケージ署名を検証する:

```bash
# 既知CVEチェック
npm audit --workspaces

# パッケージ署名・プロベナンス検証（改ざん検知）
npm audit signatures
```

**CRITICAL/HIGH の脆弱性が出た場合**: アップデートを中断し、ユーザーに報告してから対処方針を確認する。

次に、パッケージ署名の検証を試みる（npmパブリックレジストリからインストールされている場合のみ有効）:

```bash
npm audit signatures 2>&1 || echo "[INFO] signatures検証スキップ: プライベートレジストリまたはローカルキャッシュからのインストールのため非対応"
```

署名検証でエラーが出ても、npmレジストリ外からのインストール環境では正常な動作なので続行してよい。
エラーメッセージが `found no dependencies to audit that were installed from a supported registry` 以外の場合はユーザーに報告する。

### Step 3: 差分調査

インストールせずにバージョン差分を確認する:

```bash
# 全ワークスペース（frontend, backend, crawler）
npx --yes npm-check-updates --workspaces 2>/dev/null
```

出力を以下の3区分で分類してユーザーに提示する:

```
## パッケージ更新候補

### パッチ更新（自動適用予定）
- パッケージ名: 1.2.3 → 1.2.4

### マイナー更新（確認後適用）
- パッケージ名: 1.2.3 → 1.3.0

### メジャー更新（今回は適用しない・要手動対応）
- パッケージ名: 1.x.x → 2.0.0
```

更新がない場合は「全パッケージ最新です」と報告して終了する。

### Step 4: パッチ更新の適用

パッチ更新のみを自動適用する（semver範囲内、package.json変更なし）:

```bash
npm update --workspaces
```

### Step 5: マイナー更新の確認と適用

マイナー更新の候補をユーザーに確認する:

```
以下のマイナー更新を適用しますか？
（全て適用 / 個別選択 / スキップ）
```

適用する場合は `npx npm-check-updates --workspaces --target minor -u` で package.json を更新し、`npm install` で適用する。

### Step 6: セキュリティ監査（更新後）

更新後に脆弱性が増えていないか確認する:

```bash
npm audit --workspaces
```

更新前より脆弱性が増えた場合は変更を差し戻す:

```bash
git restore package.json package-lock.json frontend/package.json backend/package.json crawler/package.json
npm ci
```

### Step 7: テストとビルド確認

回帰がないことを確認する:

```bash
npm run test
npm run build
```

失敗した場合:
1. エラー内容をユーザーに報告
2. 問題のパッケージを特定して更新を差し戻す
3. 残りのパッケージのみでテストを再実行

### Step 8: コミット

成功したら変更をコミットする:

```bash
git add package.json package-lock.json frontend/package.json backend/package.json crawler/package.json
git commit -m "chore: update dependencies (patch/minor)

- パッチ更新: N件
- マイナー更新: N件"
```

---

## 注意事項

- `npm audit signatures` でエラーが出た場合は即座に中断し、当該パッケージの詳細をユーザーに報告する
- メジャー更新は必ず別のブランチで個別に対応する（一度に複数まとめて更新しない）
- `gas/` は対象外（CI未カバー・レガシー状態のため手動管理）
- `npm install` ではなく更新後は必ず `npm ci` でクリーンインストールできることを確認する
