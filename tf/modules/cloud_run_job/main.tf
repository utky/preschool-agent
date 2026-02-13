# dbt実行用サービスアカウント
resource "google_service_account" "dbt" {
  account_id   = "${var.app_name}-dbt-sa"
  display_name = "Service Account for dbt Cloud Run Job"
}

# BigQuery データ編集権限
resource "google_project_iam_member" "dbt_bigquery_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.dbt.email}"
}

# BigQuery ジョブ実行権限
resource "google_project_iam_member" "dbt_bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.dbt.email}"
}

# BigQuery 接続利用権限
resource "google_project_iam_member" "dbt_bigquery_connection_user" {
  project = var.project_id
  role    = "roles/bigquery.connectionUser"
  member  = "serviceAccount:${google_service_account.dbt.email}"
}

# API Dataバケットへの書き込み権限
resource "google_storage_bucket_iam_member" "dbt_write_api_data" {
  bucket = var.api_data_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.dbt.email}"
}

# Cloud Run Job
resource "google_cloud_run_v2_job" "dbt" {
  name                = "${var.app_name}-dbt"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.dbt.email
      timeout         = "600s"

      containers {
        image = var.container_image

        resources {
          limits = {
            memory = "2Gi"
            cpu    = "2"
          }
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "API_DATA_BUCKET_NAME"
          value = var.api_data_bucket_name
        }

        env {
          name  = "VERTEX_CONNECTION_NAME"
          value = var.vertex_connection_name
        }

        env {
          name  = "DOCUMENT_AI_PROCESSOR_PATH"
          value = var.document_ai_processor_path
        }
      }
    }
  }
}
