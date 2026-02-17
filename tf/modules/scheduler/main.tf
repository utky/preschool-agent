# Workflow 用 SA
resource "google_service_account" "workflow" {
  account_id   = "${var.app_name}-workflow-sa"
  display_name = "Service Account for Cloud Workflows"
}

# Workflow SA → 特定 Cloud Run Job の実行権限のみ
resource "google_cloud_run_v2_job_iam_member" "workflow_invoker" {
  project  = var.project_id
  location = var.region
  name     = var.dbt_job_name
  # v2 API で overrides（containerOverrides）を使うには runWithOverrides 権限が必要なため
  # roles/run.invoker（run.jobs.run のみ）ではなく roles/run.developer を使用する
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.workflow.email}"
}

# Workflow SA → Cloud Run オペレーション状態確認権限（v2 API のポーリングに必要）
resource "google_project_iam_member" "workflow_run_viewer" {
  project = var.project_id
  role    = "roles/run.viewer"
  member  = "serviceAccount:${google_service_account.workflow.email}"
}

# Workflow SA → ログ書き込み権限
resource "google_project_iam_member" "workflow_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.workflow.email}"
}

# Workflow SA → Workflow 実行権限（Scheduler から呼ばれるため）
resource "google_project_iam_member" "workflow_invoker" {
  project = var.project_id
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_service_account.workflow.email}"
}

# Cloud Workflow
resource "google_workflows_workflow" "dbt_scheduler" {
  name            = "${var.app_name}-dbt-scheduler"
  region          = var.region
  description     = "dbt Cloud Run Job を date/hour 指定で実行するワークフロー"
  service_account = google_service_account.workflow.id
  source_contents = templatefile("${path.module}/workflow.yaml", {
    project_id = var.project_id
    region     = var.region
    job_name   = var.dbt_job_name
  })
}

# Cloud Scheduler (毎時)
resource "google_cloud_scheduler_job" "dbt_hourly" {
  name             = "${var.app_name}-dbt-hourly"
  description      = "dbt ワークフローを毎時実行"
  schedule         = "0 * * * *"
  time_zone        = "Asia/Tokyo"
  region           = var.region
  attempt_deadline = "600s"

  http_target {
    http_method = "POST"
    uri         = "https://workflowexecutions.googleapis.com/v1/${google_workflows_workflow.dbt_scheduler.id}/executions"
    oauth_token {
      service_account_email = google_service_account.workflow.email
    }
    body = base64encode(jsonencode({
      argument = jsonencode({})
    }))
    headers = {
      "Content-Type" = "application/json"
    }
  }
}
