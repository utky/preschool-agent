variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
  default     = "asia-northeast1"
}

variable "iap_allowed_users" {
  type        = list(string)
  description = "IAPでアクセスを許可するユーザーのメールアドレスのリスト"
  default     = []
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
