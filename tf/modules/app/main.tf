# サービスアカウントの作成
resource "google_service_account" "default" {
  account_id   = "${var.app_name}-cloud-run-sa"
  display_name = "Service Account for Preschool Agent"
}

# --- アクセスログ用Cloud Storageバケット ---

resource "google_storage_bucket" "access_logs" {
  name          = "${var.app_name}-${var.project_id}-access-logs"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  # ログバケット自体のライフサイクル: 90日後に削除
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# --- フロントエンド用Cloud Storageバケット ---

resource "google_storage_bucket" "frontend" {
  name          = "${var.app_name}-${var.project_id}-frontend"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  # バージョニング有効化
  versioning {
    enabled = true
  }

  # 直近2バージョンより古いものを削除
  lifecycle_rule {
    condition {
      num_newer_versions = 2
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # アクセスログの出力先
  logging {
    log_bucket = google_storage_bucket.access_logs.name
  }

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  # 注意: Cloud Run URIへの制限は循環依存を生むため、
  # 実行時にCloud Run側でCORSを制御する
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# フロントエンドバケットを公開
resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# バックエンドがフロントエンドバケットを読み取る権限
resource "google_storage_bucket_iam_member" "backend_read_frontend" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.default.email}"
}

# --- API Data用Cloud Storageバケット ---

resource "google_storage_bucket" "api_data" {
  name          = "${var.app_name}-${var.project_id}-api-data"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true
}

# バックエンドがAPI Dataバケットを読み取る権限
resource "google_storage_bucket_iam_member" "backend_read_api_data" {
  bucket = google_storage_bucket.api_data.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.default.email}"
}

# --- PDF Uploads用Cloud Storageバケット ---

resource "google_storage_bucket" "pdf_uploads" {
  name          = "${var.app_name}-${var.project_id}-pdf-uploads"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

# GAS用サービスアカウント
resource "google_service_account" "gas" {
  account_id   = "${var.app_name}-gas-sa"
  display_name = "Service Account for Google Apps Script"
}

# GASがPDF Uploadsバケットに書き込む権限
resource "google_storage_bucket_iam_member" "gas_write_pdf_uploads" {
  bucket = google_storage_bucket.pdf_uploads.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.gas.email}"
}

# バックエンドがPDF Uploadsバケットを読み取る権限
resource "google_storage_bucket_iam_member" "backend_read_pdf_uploads" {
  bucket = google_storage_bucket.pdf_uploads.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.default.email}"
}

# --- Vertex AI / BigQuery 権限（Mastraエージェント用） ---

# Vertex AI (Gemini) 呼び出し権限
resource "google_project_iam_member" "cloud_run_vertex_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.default.email}"
}

# BigQueryジョブ実行権限
resource "google_project_iam_member" "cloud_run_bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.default.email}"
}

# BigQueryデータ読み取り権限
resource "google_project_iam_member" "cloud_run_bigquery_data_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.default.email}"
}

# Secret Managerへのアクセス権限を付与
#resource "google_project_iam_member" "secret_accessor" {
#  project = var.project_id
#  role    = "roles/secretmanager.secretAccessor"
#  member  = "serviceAccount:${google_service_account.default.email}"
#}

# --- 認証関連リソース --- 

# 必要なAPIを有効化
resource "google_project_service" "iap" {
  project = var.project_id
  service = "iap.googleapis.com"
}

resource "google_project_service" "secretmanager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"
}

# --- シークレットの定義 ---

# Next.js用auth_secret
# ----------------------------------------------------------------
resource "google_secret_manager_secret" "auth_secret" {
  project   = var.project_id
  secret_id = "${var.app_name}--auth-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_secret" {
  secret      = google_secret_manager_secret.auth_secret.id
  secret_data = var.auth_secret_value
}

data "google_iam_policy" "auth_secret" {
  binding {
    role = "roles/secretmanager.secretAccessor"
    members = [
      "serviceAccount:${google_service_account.default.email}",
    ]
  }
}

resource "google_secret_manager_secret_iam_policy" "auth_secret" {
  project     = var.project_id
  secret_id   = google_secret_manager_secret.auth_secret.id
  policy_data = data.google_iam_policy.auth_secret.policy_data
}

# 認可ユーザリストのシークレット
# ----------------------------------------------------------------

resource "google_secret_manager_secret" "allowed_user_emails" {
  project   = var.project_id
  secret_id = "${var.app_name}--allowed-user-emails"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "allowed_user_emails" {
  secret      = google_secret_manager_secret.allowed_user_emails.id
  secret_data = var.allowed_user_emails_value
}

data "google_iam_policy" "allowed_user_emails" {
  binding {
    role = "roles/secretmanager.secretAccessor"
    members = [
      "serviceAccount:${google_service_account.default.email}",
    ]
  }
}

resource "google_secret_manager_secret_iam_policy" "allowed_user_emails" {
  project     = var.project_id
  secret_id   = google_secret_manager_secret.allowed_user_emails.id
  policy_data = data.google_iam_policy.allowed_user_emails.policy_data
}

# Google OAuth Client IDのシークレット
# ----------------------------------------------------------------
resource "google_secret_manager_secret" "auth_google_id" {
  project   = var.project_id
  secret_id = "${var.app_name}--auth-google-id"
  replication {
    auto {}
  }
}

data "google_iam_policy" "auth_google_id" {
  binding {
    role = "roles/secretmanager.secretAccessor"
    members = [
      "serviceAccount:${google_service_account.default.email}",
    ]
  }
}

resource "google_secret_manager_secret_iam_policy" "auth_google_id" {
  project     = var.project_id
  secret_id   = google_secret_manager_secret.auth_google_id.id
  policy_data = data.google_iam_policy.auth_google_id.policy_data
}

# Google OAuth Client Secretのシークレット
# ----------------------------------------------------------------
resource "google_secret_manager_secret" "auth_google_secret" {
  project   = var.project_id
  secret_id = "${var.app_name}--auth-google-secret"
  replication {
    auto {}
  }
}

data "google_iam_policy" "auth_google_secret" {
  binding {
    role = "roles/secretmanager.secretAccessor"
    members = [
      "serviceAccount:${google_service_account.default.email}",
    ]
  }
}

resource "google_secret_manager_secret_iam_policy" "auth_google_secret" {
  project     = var.project_id
  secret_id   = google_secret_manager_secret.auth_google_secret.id
  policy_data = data.google_iam_policy.auth_google_secret.policy_data
}

# --- Cloud Run サービス ---

resource "google_cloud_run_v2_service" "default" {
  name        = var.app_name
  description = "School Agent Web Application"
  location    = var.region
  ingress     = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    service_account                  = google_service_account.default.email
    max_instance_request_concurrency = 10

    containers {
      image = var.container_image
      ports {
        container_port = 3000
      }

      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "ALLOWED_USER_EMAILS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.allowed_user_emails.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "AUTH_GOOGLE_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_google_id.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_GOOGLE_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_google_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "FRONTEND_BUCKET_NAME"
        value = google_storage_bucket.frontend.name
      }

      env {
        name  = "API_DATA_BUCKET_NAME"
        value = google_storage_bucket.api_data.name
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      env {
        name  = "BIGQUERY_DATASET_ID"
        value = "school_agent"
      }
    }
  }
  depends_on = [
    google_secret_manager_secret_version.auth_secret,
    google_secret_manager_secret_version.allowed_user_emails,
    google_secret_manager_secret_iam_policy.auth_google_id,
    google_secret_manager_secret_iam_policy.auth_google_secret,
  ]
}

# Cloud Runサービスを一般公開する
resource "google_cloud_run_v2_service_iam_binding" "allow_all" {
  project  = google_cloud_run_v2_service.default.project
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}
