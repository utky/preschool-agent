output "service_name" {
  value       = google_cloud_run_v2_service.default.name
  description = "The name of the Cloud Run service."
}

output "service_url" {
  value       = google_cloud_run_v2_service.default.uri
  description = "The URL of the Cloud Run service."
}
