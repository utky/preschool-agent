variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
}

variable "container_image" {
  type        = string
  description = "デプロイするコンテナイメージ"
}
