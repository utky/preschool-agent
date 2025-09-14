variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
  default     = "asia-northeast1"
}

variable "iap_support_email" {
  type        = string
  description = "IAPの同意画面に表示されるサポートメールアドレス"
}

variable "iap_allowed_users" {
  type        = list(string)
  description = "IAPでアクセスを許可するユーザーのメールアドレスのリスト"
  default     = []
}
