resource "google_project_service" "iap" {
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

# IAPで保護されたWebアプリへのアクセスを許可するメンバーを設定
resource "google_cloud_run_v2_service_iam_member" "allow_users" {
  for_each = toset(var.iap_allowed_users)

  project  = var.project_id
  location = var.region
  name     = var.cloud_run_service_name
  role     = "roles/run.invoker"
  member   = "user:${each.value}"
}
