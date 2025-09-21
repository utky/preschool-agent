# サービスアカウントの作成
resource "google_service_account" "default" {
  account_id   = "${var.app_name}-cloud-run-sa"
  display_name = "Service Account for Preschool Agent"
}

# Secret Managerへのアクセス権限を付与
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.default.email}"
}

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

# OAuth同意画面の設定
resource "google_iap_brand" "default" {
  project          = var.project_id
  support_email    = var.user_email
  application_title = "Preschool Agent"
}

# OAuthクライアントIDの作成
resource "google_iap_client" "default" {
  display_name = "${app_name}-client"
  brand        = google_iap_brand.default.name
}

# --- シークレットの定義 ---

resource "google_secret_manager_secret" "auth_google_id" {
  project   = var.project_id
  secret_id = "${var.app_name}--auth-google-id"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_google_id" {
  secret      = google_secret_manager_secret.auth_google_id.id
  secret_data = google_iap_client.default.client_id
}

resource "google_secret_manager_secret" "auth_google_secret" {
  project   = var.project_id
  secret_id = "${var.app_name}--auth-google-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "auth_google_secret" {
  secret      = google_secret_manager_secret.auth_google_secret.id
  secret_data = google_iap_client.default.secret
}

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

# --- Cloud Run サービス ---

resource "google_cloud_run_v2_service" "default" {
  name     = "${var.app_name}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.default.email

    containers {
      image = var.container_image
      ports {
        container_port = 3000
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
        name = "ALLOWED_USER_EMAILS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.allowed_user_emails.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

# Cloud Runサービスを一般公開する
resource "google_cloud_run_v2_service_iam_binding" "allow_all" {
  project  = google_cloud_run_v2_service.default.project
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}
