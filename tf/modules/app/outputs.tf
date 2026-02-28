output "service_name" {
  value       = google_cloud_run_v2_service.default.name
  description = "The name of the Cloud Run service."
}

output "service_url" {
  value       = google_cloud_run_v2_service.default.uri
  description = "The URL of the Cloud Run service."
}

output "frontend_bucket_name" {
  value       = google_storage_bucket.frontend.name
  description = "The name of the frontend GCS bucket."
}

output "frontend_bucket_url" {
  value       = "https://storage.googleapis.com/${google_storage_bucket.frontend.name}"
  description = "The public URL of the frontend GCS bucket."
}

output "api_data_bucket_name" {
  value       = google_storage_bucket.api_data.name
  description = "The name of the API data GCS bucket."
}

output "pdf_uploads_bucket_name" {
  value       = google_storage_bucket.pdf_uploads.name
  description = "The name of the PDF uploads GCS bucket."
}

output "gas_service_account_email" {
  value       = google_service_account.gas.email
  description = "The email of the GAS service account."
}

output "seeds_bucket_name" {
  value       = google_storage_bucket.seeds.name
  description = "The name of the seeds GCS bucket."
}
