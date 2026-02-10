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
