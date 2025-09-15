output "cloud_run_service_url" {
  value       = module.app.service_url
  description = "The URL of the Cloud Run service."
}

output "workload_identity_provider" {
  value = module.wif.workload_identity_provider
}

output "service_account_email" {
  value = module.wif.service_account_email
}
