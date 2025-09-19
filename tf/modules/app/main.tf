data "google_artifact_registry_repository" "docker_repo" {
  provider      = google
  location      = var.region
  repository_id = "utky-applications"
}

resource "google_cloud_run_v2_service" "default" {
  name     = "school-agent"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL" # IAPを使うためにALLに設定

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
