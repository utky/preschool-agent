variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "cloud_run_service_name" {
  type        = string
  description = "The name of the Cloud Run service to protect with IAP."
}

variable "region" {
  type        = string
  description = "The region where the Cloud Run service is deployed."
}



variable "iap_allowed_users" {
  type        = list(string)
  description = "IAPでアクセスを許可するユーザーのメールアドレスのリスト"
  default     = []
}
