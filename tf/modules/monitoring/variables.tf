variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "frontend_bucket_name" {
  type        = string
  description = "監視対象のフロントエンドGCSバケット名"
}

variable "alert_email" {
  type        = string
  description = "アラート通知先のメールアドレス"
}

variable "egress_threshold_bytes_per_second" {
  type        = number
  description = "GCSエグレス送信バイト数の閾値（バイト/秒）"
  default     = 2048 # 2KB/s
}

variable "cloud_run_service_name" {
  type        = string
  description = "監視対象のCloud Runサービス名"
}

variable "cloud_run_request_threshold" {
  type        = number
  description = "Cloud Runリクエスト数の閾値（リクエスト/秒）。この値を超えたらアラート"
  default     = 10 # 10 req/s = 600 req/min
}
