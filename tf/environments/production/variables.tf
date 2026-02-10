variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
  default     = "asia-northeast1"
}

variable "container_image" {
  type        = string
  description = "デプロイするコンテナイメージ"
  default     = "asia-northeast1-docker.pkg.dev/lofilab/utky-applications/school-agent:latest"
}

variable "allowed_user_emails_value" {
  type        = string
  description = "アクセスを許可するユーザーのメールアドレスリスト（カンマ区切り）"
  sensitive   = true
}

variable "dbt_container_image" {
  type        = string
  description = "dbt用コンテナイメージ"
  default     = "asia-northeast1-docker.pkg.dev/lofilab/utky-applications/school-agent-dbt:latest"
}

variable "alert_email" {
  type        = string
  description = "アラート通知先のメールアドレス"
}
