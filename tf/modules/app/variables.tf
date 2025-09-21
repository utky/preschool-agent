variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
}

variable "app_name" {
  type = string
  description = "アプリケーション名"
  default = "school-agent"
}

variable "container_image" {
  type        = string
  description = "デプロイするコンテナイメージ"
}

variable "user_email" {
  type        = string
  description = "OAuth同意画面に表示するユーザーサポートメール"
}

variable "auth_secret_value" {
  type        = string
  description = "Auth.jsで使用するAUTH_SECRETの値"
  sensitive   = true
}

variable "allowed_user_emails_value" {
  type        = string
  description = "アクセスを許可するユーザーのメールアドレスリスト（カンマ区切り）"
  sensitive   = true
}
