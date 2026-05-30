output "alert_policy_id" {
  value       = google_monitoring_alert_policy.gcs_egress.id
  description = "GCSエグレスアラートポリシーのID"
}

output "cloud_run_alert_policy_id" {
  value       = google_monitoring_alert_policy.cloud_run_request_rate.id
  description = "Cloud Runリクエスト数アラートポリシーのID"
}

output "notification_channel_id" {
  value       = google_monitoring_notification_channel.email.id
  description = "メール通知チャネルのID"
}
