variable "project_id" {
  type        = string
  description = "GCPプロジェクトID"
}

variable "region" {
  type        = string
  description = "リージョン"
}

variable "app_name" {
  type        = string
  default     = "school-agent"
  description = "アプリケーション名"
}

variable "container_image" {
  type        = string
  description = "クローラーコンテナイメージ"
}

variable "pdf_uploads_bucket_name" {
  type        = string
  description = "PDFアップロード先GCSバケット名"
}

variable "wordpress_base_url" {
  type        = string
  description = "WordPress REST APIのベースURL"
  default     = "https://tatibana.ed.jp/youtien"
}
