## 5. データモデル設計 (BigQuery)

TypeScriptの型定義（またはZodスキーマ）をスキーマ定義の原本とし、BigQueryのテーブルスキーマもこれに準拠します。

- **`documents` テーブル**: アップロードされたPDFのメタ情報。
    - `id` (STRING, REQUIRED)
    - `source_drive_id` (STRING, REQUIRED)
    - `source_filename` (STRING, REQUIRED)
    - `document_type` (STRING, REQUIRED)
    - `processed_at` (TIMESTAMP, REQUIRED)

- **`images` テーブル**: 抽出された画像の情報。
    - `id` (STRING, REQUIRED)
    - `document_id` (STRING, REQUIRED)
    - `gcs_path` (STRING, REQUIRED)

- **`calendar_events` テーブル**: カレンダー登録候補の情報。
    - `id` (STRING, REQUIRED)
    - `document_id` (STRING, REQUIRED)
    - `title` (STRING, REQUIRED)
    - `event_date` (DATE, REQUIRED)
    - `description` (STRING)
    - `status` (STRING, REQUIRED)
    - `created_at` (TIMESTAMP, REQUIRED)

- **`journal` テーブル**: `journal`（お知らせ）の構造化データ。
    - `document_id` (STRING, REQUIRED)
    - `title` (STRING)
    - `issue_number` (INTEGER)
    - `published_date` (DATE)
    - `sections` (RECORD, REPEATED)

- **`photo_album` テーブル**: `photo_album`（写真集）の構造化データ。
    - `document_id` (STRING, REQUIRED)
    - `title` (STRING)
    - `author` (STRING)
    - `published_date` (DATE)
    - `nursery_name` (STRING)
    - `childcare_plan` (STRING)

- **`monthly_announcement` テーブル**: `monthly_announcement`（月次お知らせ）の構造化データ。
    - `document_id` (STRING, REQUIRED)
    - `title` (STRING)
    - `preface` (STRING)
    - `schedules` (RECORD, REPEATED)
    - `monthly_goals` (STRING)
    - `sections` (RECORD, REPEATED)

- **`monthly_lunch_schedule` テーブル**: `monthly_lunch_schedule`（月次給食献立表）の構造化データ。
    - `document_id` (STRING, REQUIRED)
    - `month` (STRING)
    - `nursery_name` (STRING)
    - `schedule` (RECORD, REPEATED)
    - `nutrition_summary` (RECORD)

- **`monthly_lunch_info` テーブル**: `monthly_lunch_info`（給食お知らせ）の構造化データ。
    - `document_id` (STRING, REQUIRED)
    - `month` (STRING)
    - `author` (STRING)
    - `preface` (STRING)
    - `sections` (RECORD, REPEATED)
