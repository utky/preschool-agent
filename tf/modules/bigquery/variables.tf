variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "location" {
  type        = string
  description = "BigQueryデータセットのロケーション"
  default     = "US"
}

variable "dataset_id" {
  type        = string
  description = "BigQueryデータセットID"
  default     = "school_agent"
}

variable "app_name" {
  type        = string
  description = "アプリケーション名"
  default     = "school-agent"
}

variable "pdf_uploads_bucket_name" {
  type        = string
  description = "PDF Uploadsバケット名"
}
