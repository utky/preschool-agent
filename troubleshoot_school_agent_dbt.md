# school-agent-dbt Cloud Run Job 障害調査記録

## 調査日時
2026-03-10

## 障害概要

`school-agent-dbt` Cloud Run Job が継続的に失敗している。

---

## 調査コマンド

### 1. Cloud Run Job の最新実行ログ確認

```bash
# ジョブ一覧と最新実行状況
gcloud run jobs describe school-agent-dbt --region=asia-northeast1

# 最新の実行ログ取得
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="school-agent-dbt"' \
  --limit=100 \
  --format='table(timestamp, severity, textPayload)' \
  --order=desc
```

### 2. dbt テスト失敗の確認

```bash
# Cloud Run Job の実行履歴
gcloud run jobs executions list --job=school-agent-dbt --region=asia-northeast1

# 特定の実行ログ詳細（execution名は上記で取得）
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.execution_name="school-agent-dbt-XXXXX"' \
  --format='value(textPayload)'
```

### 3. BigQuery で重複データ確認

```bash
bq query --nouse_legacy_sql '
  SELECT event_id, COUNT(*) AS cnt
  FROM `school_agent.fct_calendar_sync_history`
  GROUP BY event_id
  HAVING cnt > 1
  ORDER BY cnt DESC
  LIMIT 20
'
```

### 4. dbt テストをローカルで実行

```bash
cd dbt && dbt test --select fct_calendar_sync_history
```

### 5. dbt full refresh で重複データを解消

```bash
cd dbt && dbt run --select fct_calendar_sync_history --full-refresh
```

---

## 調査結果

### 根本原因

`dbt test` の `unique_fct_calendar_sync_history_event_id` テスト失敗。

```
Failure in test unique_fct_calendar_sync_history_event_id
Got 1 result, configured to fail if != 0
Done. PASS=58 WARN=0 ERROR=1 SKIP=8 NO-OP=0 TOTAL=67
```

`fct_calendar_sync_history` テーブルに、同じ `event_id` が複数回 INSERT されていた。

### 失敗の連鎖

```
Cloud Run Job (dbt build)
  → dbt run (成功)
  → dbt test
    → unique_fct_calendar_sync_history_event_id (失敗)
      → exit code 1
        → Job が失敗判定 → Max Retries=3 でリトライ → さらに重複増加
```

### 重複の原因

`backend/src/lib/calendar.ts` の `recordSync()` が BigQuery `table.insert()` を使用しており、冪等性がなかった。
Cloud Run Job の Max Retries=3 により、ジョブリトライのたびに同じ `event_id` が再 INSERT された。

---

## 対処

### 1. データ修復（dbt full refresh）

```bash
cd dbt && dbt run --select fct_calendar_sync_history --full-refresh
```

### 2. 根本対応

`backend/src/lib/calendar.ts` の `recordSync()` を INSERT → BigQuery MERGE に変更し、冪等な upsert を実現。

---

## 検証

```bash
# 1. 重複データが解消されているか確認
bq query --nouse_legacy_sql '
  SELECT event_id, COUNT(*) AS cnt
  FROM `school_agent.fct_calendar_sync_history`
  GROUP BY event_id
  HAVING cnt > 1
'

# 2. dbt test がパスするか確認
cd dbt && dbt test --select fct_calendar_sync_history

# 3. バックエンドテスト
cd backend && npm run test

# 4. Cloud Run Job を手動実行して確認
gcloud run jobs execute school-agent-dbt --region=asia-northeast1 --wait
```
