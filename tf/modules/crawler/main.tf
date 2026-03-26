# クローラー用サービスアカウント
resource "google_service_account" "crawler_sa" {
  account_id   = "${var.app_name}-crawler-sa"
  display_name = "Service Account for PDF Crawler"
  project      = var.project_id
}

# クローラーSA → PDFアップロードバケットへの書き込み権限
resource "google_storage_bucket_iam_member" "crawler_pdf_uploads" {
  bucket = var.pdf_uploads_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.crawler_sa.email}"
}

# クローラー Cloud Run Job
resource "google_cloud_run_v2_job" "crawler" {
  name     = "${var.app_name}-crawler"
  location = var.region
  project  = var.project_id

  template {
    template {
      service_account = google_service_account.crawler_sa.email

      containers {
        image = var.container_image

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "GCS_BUCKET_NAME"
          value = var.pdf_uploads_bucket_name
        }
        env {
          name  = "WORDPRESS_BASE_URL"
          value = var.wordpress_base_url
        }
        # SINCE_DATETIME は Cloud Workflows から containerOverride で注入される
      }
    }
  }

  lifecycle {
    ignore_changes = [
      # CI/CDでイメージを更新するため差分を無視
      template[0].template[0].containers[0].image,
    ]
  }
}
