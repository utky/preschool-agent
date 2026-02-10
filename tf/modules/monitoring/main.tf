# Cloud Monitoring API の有効化
resource "google_project_service" "monitoring" {
  project = var.project_id
  service = "monitoring.googleapis.com"
}

# メール通知チャネル
resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "GCS Egress Alert Email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.monitoring]
}

# GCS フロントエンドバケットのエグレスアラートポリシー
resource "google_monitoring_alert_policy" "gcs_egress" {
  project      = var.project_id
  display_name = "GCS Frontend Bucket Egress Alert"
  combiner     = "OR"

  conditions {
    display_name = "GCS sent bytes rate exceeds threshold"

    condition_threshold {
      filter = <<-EOT
        resource.type = "gcs_bucket"
        AND resource.labels.bucket_name = "${var.frontend_bucket_name}"
        AND metric.type = "storage.googleapis.com/network/sent_bytes_count"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = var.egress_threshold_bytes_per_second
      duration        = "60s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.id
  ]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "GCS frontend bucket (${var.frontend_bucket_name}) egress rate has exceeded ${var.egress_threshold_bytes_per_second} bytes/s. This may indicate unexpected traffic or a potential abuse."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.monitoring]
}
