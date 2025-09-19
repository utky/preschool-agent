data "google_artifact_registry_repository" "docker_repo" {
  provider      = google
  location      = var.region
  repository_id = "utky-applications"
}

# IAP is only available for projects that are part of an Organization.
# なのでIAPは使えない
resource "google_cloud_run_v2_service" "default" {
  name     = "school-agent"
  location = var.region
  #ingress  = "INGRESS_TRAFFIC_ALL" # IAPを使うためにALLに設定
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY" # 認証が整うまで攻撃防止のためにルーティング止める

  template {
    containers {
      image = "${data.google_artifact_registry_repository.docker_repo.location}-docker.pkg.dev/${data.google_artifact_registry_repository.docker_repo.project}/${data.google_artifact_registry_repository.docker_repo.repository_id}/school-agent:latest" 
    }
  }
}

resource "google_cloud_run_v2_service_iam_binding" "allow_all_for_iap" {
  project  = google_cloud_run_v2_service.default.project
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}
