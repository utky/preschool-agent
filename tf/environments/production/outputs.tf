output "cloud_run_service_url" {
  value       = module.app.service_url
  description = "The URL of the Cloud Run service."
}
