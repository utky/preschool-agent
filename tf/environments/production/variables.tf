variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
  default     = "asia-northeast1"
}

variable "github_repo" {
  type        = string
  description = "The GitHub repository in the format 'owner/repo'."
}

variable "container_image" {
  type        = string
  description = "デプロイするコンテナイメージ"
  default     = "asia-northeast1-docker.pkg.dev/lofilab/utky-applications/school-agent:latest"
}

variable "user_email" {
  type        = string
  description = "OAuth同意画面に表示するユーザーサポートメール"
}

variable "allowed_user_emails_value" {
  type        = string
  description = "アクセスを許可するユーザーのメールアドレスリスト（カンマ区切り）"
  sensitive   = true
}

variable "iap_allowed_users" {
  type = list(string)
  description = "IAPでアクセスを許可するユーザー"
  default = []
}
