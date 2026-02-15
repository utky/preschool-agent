output "workflow_name" {
  value       = google_workflows_workflow.dbt_scheduler.name
  description = "Cloud Workflow名"
}

output "scheduler_name" {
  value       = google_cloud_scheduler_job.dbt_hourly.name
  description = "Cloud Scheduler Job名"
}

output "workflow_sa_email" {
  value       = google_service_account.workflow.email
  description = "Workflow用サービスアカウントのメールアドレス"
}
