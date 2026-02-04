# Google Apps Script - Drive to GCS Sync

Google DriveのPDFファイルをGoogle Cloud Storageに自動同期するGoogle Apps Scriptプロジェクト。

## 機能

- 指定フォルダ内のPDFファイルを1時間ごとに監視
- 新規PDFをGCSにコピー（パス形式: `{YYYY-MM-DD}/{HH}/{file_id}.pdf`）
- 重複アップロード防止（処理済みファイルIDを記録）
- エラー時の自動リトライ（指数バックオフ）

## セットアップ

### 1. 依存関係のインストール

```bash
cd gas
npm install
```

### 2. claspの設定

```bash
npx clasp login
npx clasp create --type standalone --title "Drive to GCS Sync"
```

### 3. Script Propertiesの設定

Google Apps Scriptエディタで以下のプロパティを設定:

- `DRIVE_FOLDER_ID`: 監視対象のGoogle DriveフォルダID
- `GCS_BUCKET_NAME`: アップロード先のGCSバケット名
- `GCP_PROJECT_ID`: GCPプロジェクトID

### 4. デプロイ

```bash
npm run push
```

### 5. トリガーの設定

Google Apps Scriptエディタで `setupTrigger` 関数を実行

## 開発

```bash
# ビルド（TypeScript → JavaScript）
npm run build

# 監視モード
npm run watch

# ビルド＆デプロイ
npm run push
```

## ファイル構成

```
gas/
├── src/
│   ├── main.ts      # エントリーポイント、グローバル関数
│   ├── config.ts    # 設定管理
│   ├── drive.ts     # Google Drive操作
│   └── gcs.ts       # GCS操作
├── dist/
│   └── Code.js      # ビルド出力（GASにデプロイ）
├── appsscript.json  # GASプロジェクト設定
├── package.json
└── tsconfig.json
```

## GCS パス形式

```
gs://{bucket}/{YYYY-MM-DD}/{HH}/{drive_file_id}.pdf
```

例: `gs://school-agent-prod-pdf-uploads/2026-01-30/15/abc123xyz.pdf`

## メタデータ

アップロード時に以下のメタデータを付与:
- `x-goog-meta-original-filename`: 元のファイル名
- `x-goog-meta-drive-file-id`: Google DriveのファイルID
