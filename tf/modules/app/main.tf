# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  provider      = google
  location      = var.region
  repository_id = "app-images"
  description   = "Docker repository for the application"
  format        = "DOCKER"
}

resource "google_cloud_run_v2_service" "default" {
  name     = "preschool-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL" # IAPを使うためにALLに設定

  template {
    containers {
      image = "us-docker.pkg.dev/run/container/hello" # 初期イメージ (後でCI/CDでビルドしたものに置き換える)
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


