variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "location" {
  type        = string
  description = "Document AIプロセッサーのロケーション"
  default     = "us"
}

variable "app_name" {
  type        = string
  description = "アプリケーション名"
  default     = "school-agent"
}
