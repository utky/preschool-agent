output "cloud_run_service_url" {
  value       = module.app.service_url
  description = "The URL of the Cloud Run service."
}

output "frontend_bucket_name" {
  value       = module.app.frontend_bucket_name
  description = "The name of the frontend GCS bucket."
}

output "frontend_bucket_url" {
  value       = module.app.frontend_bucket_url
  description = "The public URL of the frontend GCS bucket."
}

output "api_data_bucket_name" {
  value       = module.app.api_data_bucket_name
  description = "The name of the API data GCS bucket."
}

output "pdf_uploads_bucket_name" {
  value       = module.app.pdf_uploads_bucket_name
  description = "The name of the PDF uploads GCS bucket."
}

output "gas_service_account_email" {
  value       = module.app.gas_service_account_email
  description = "The email of the GAS service account."
}

output "document_ai_processor_id" {
  value       = module.document_ai.processor_id
  description = "Document AI OCR processor ID."
}

output "bigquery_dataset_id" {
  value       = module.bigquery.dataset_id
  description = "BigQuery dataset ID."
}

output "bigquery_vertex_connection_name" {
  value       = module.bigquery.vertex_connection_name
  description = "BigQuery Vertex AI connection name."
}

output "bigquery_raw_documents_table_id" {
  value       = module.bigquery.raw_documents_table_id
  description = "BigQuery raw_documents Object Table ID"
}

output "dbt_job_name" {
  value       = module.cloud_run_job.job_name
  description = "Cloud Run Job name for dbt."
}

output "gcs_egress_alert_policy_id" {
  value       = module.monitoring.alert_policy_id
  description = "GCS egress alert policy ID."
}
