output "dataset_id" {
  value       = google_bigquery_dataset.main.dataset_id
  description = "BigQueryデータセットID"
}

output "vertex_connection_id" {
  value       = google_bigquery_connection.vertex.connection_id
  description = "Vertex AI接続ID"
}

output "vertex_connection_name" {
  value       = "${var.project_id}.${var.location}.${google_bigquery_connection.vertex.connection_id}"
  description = "Vertex AI接続の完全修飾名"
}

output "raw_documents_table_id" {
  value       = google_bigquery_table.raw_documents.table_id
  description = "Object Table（raw_documents）のテーブルID"
}
