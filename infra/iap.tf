resource "google_project_service" "iap" {
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

resource "google_iap_brand" "project_brand" {
  support_email     = var.iap_support_email
  application_title = "Preschool Agent"
  project           = var.project_id
  depends_on        = [google_project_service.iap]
}

resource "google_iap_client" "project_client" {
  display_name = "Preschool Agent IAP Client"
  brand        = google_iap_brand.project_brand.name
}

# IAPを有効にするバックエンドサービスを取得
# Cloud Runのバックエンドサービス名は `run.googleapis.com/services/` + サービス名
data "google_iap_web_backend_service" "default" {
  project       = var.project_id
  backend_service = google_cloud_run_v2_service.default.name
}

# IAPで保護されたWebアプリへのアクセスを許可するメンバーを設定
resource "google_iap_web_iam_member" "allow_users" {
  for_each = toset(var.iap_allowed_users)

  project = data.google_iap_web_backend_service.default.project
  role    = "roles/iap.httpsResourceAccessor"
  member  = "user:${each.value}"
}
