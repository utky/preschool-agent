variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "region" {
  type        = string
  description = "リソースを作成するリージョン"
}

variable "app_name" {
  type        = string
  description = "アプリケーション名"
  default     = "school-agent"
}

variable "container_image" {
  type        = string
  description = "dbt用コンテナイメージ"
}

variable "api_data_bucket_name" {
  type        = string
  description = "API DataバケットのGCS名"
}

variable "dataset_id" {
  type        = string
  description = "BigQueryデータセットID"
  default     = "school_agent"
}

variable "vertex_connection_name" {
  type        = string
  description = "BigQuery Vertex AI接続の完全修飾名"
}

variable "document_ai_processor_path" {
  type        = string
  description = "Document AI OCRプロセッサーのリソース名"
}

variable "seeds_bucket_name" {
  type        = string
  description = "dbt seed ファイル用 GCS バケット名"
}
