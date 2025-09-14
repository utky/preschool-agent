resource "google_cloud_run_v2_service" "default" {
  name     = "preschool-agent"
  location = var.region

  template {
    containers {
      image = "us-docker.pkg.dev/run/container/hello" # 初期イメージ (後でCI/CDでビルドしたものに置き換える)
    }
  }
}


