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

variable "dbt_job_name" {
  type        = string
  description = "Cloud Run Job名"
}
