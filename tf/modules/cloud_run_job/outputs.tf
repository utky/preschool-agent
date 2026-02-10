output "job_name" {
  value       = google_cloud_run_v2_job.dbt.name
  description = "Cloud Run Job名"
}

output "service_account_email" {
  value       = google_service_account.dbt.email
  description = "dbt用サービスアカウントのメールアドレス"
}
