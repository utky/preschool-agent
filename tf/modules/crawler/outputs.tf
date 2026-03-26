output "job_name" {
  description = "Cloud Run Job名"
  value       = google_cloud_run_v2_job.crawler.name
}

output "service_account_email" {
  description = "クローラーサービスアカウントのメールアドレス"
  value       = google_service_account.crawler_sa.email
}
