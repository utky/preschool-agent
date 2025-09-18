resource "google_project_service" "iap" {
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

# IAPで保護されたWebアプリへのアクセスを許可するメンバーを設定
resource "google_iap_web_backend_service_iam_member" "allow_users" {
  for_each = toset(var.iap_allowed_users)

  project             = var.project_id
  web_backend_service = var.cloud_run_service_name
  role                = "roles/iap.httpsResourceAccessor"
  member              = "user:${each.value}"
}
