output "alert_policy_id" {
  value       = google_monitoring_alert_policy.gcs_egress.id
  description = "GCSエグレスアラートポリシーのID"
}

output "notification_channel_id" {
  value       = google_monitoring_notification_channel.email.id
  description = "メール通知チャネルのID"
}
