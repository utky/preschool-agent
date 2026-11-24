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

# Cloud Run リクエスト数アラート（DoS・異常課金検知）
resource "google_monitoring_alert_policy" "cloud_run_request_rate" {
  project      = var.project_id
  display_name = "Cloud Run High Request Rate Alert"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run request rate exceeds threshold"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "${var.cloud_run_service_name}"
        AND metric.type = "run.googleapis.com/request_count"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_run_request_threshold
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
    content   = "Cloud Run service (${var.cloud_run_service_name}) request rate has exceeded ${var.cloud_run_request_threshold} req/s. This may indicate a DoS attack or unexpected traffic spike causing abnormal billing."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.monitoring]
}

# PDF抽出漏れアラート（dbt の assert_all_pdfs_extracted テストが WARN を出したら通知）
# テストは severity: warn のため dbt Job 自体は成功する。ログの WARN 行を検知して通知する
resource "google_monitoring_alert_policy" "pdf_extraction_failure" {
  project      = var.project_id
  display_name = "PDF Extraction Failure Alert"
  combiner     = "OR"

  conditions {
    display_name = "dbt test assert_all_pdfs_extracted reported WARN"

    condition_matched_log {
      filter = <<-EOT
        resource.type = "cloud_run_job"
        AND resource.labels.job_name = "${var.dbt_job_name}"
        AND textPayload =~ "WARN [0-9]+ assert_all_pdfs_extracted"
      EOT
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.id
  ]

  alert_strategy {
    # dbt は 6 時間ごとに実行されるため、通知も最大 6 時間に 1 通に抑える
    notification_rate_limit {
      period = "21600s"
    }
    auto_close = "86400s"
  }

  documentation {
    content   = <<-EOT
      dbt test `assert_all_pdfs_extracted` detected PDFs that were not extracted (dbt job: ${var.dbt_job_name}).
      Check failed rows with:
      `SELECT uri, ml_generate_text_status, processed_at FROM school_agent.stg_pdf_uploads__extracted_texts WHERE NOT is_extracted`
      Unprocessed PDFs (in raw_documents but not in staging) need a manual backfill with start_datetime / end_datetime vars.
    EOT
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.monitoring]
}
