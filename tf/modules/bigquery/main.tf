# BigQuery API を有効化
resource "google_project_service" "bigquery" {
  project = var.project_id
  service = "bigquery.googleapis.com"
}

resource "google_project_service" "bigquery_connection" {
  project = var.project_id
  service = "bigqueryconnection.googleapis.com"
}

# BigQuery データセット
resource "google_bigquery_dataset" "main" {
  project                    = var.project_id
  dataset_id                 = var.dataset_id
  friendly_name              = "School Agent Dataset"
  description                = "Dataset for school document processing"
  location                   = var.location
  delete_contents_on_destroy = false

  depends_on = [google_project_service.bigquery]
}

# Vertex AI 接続（BigQueryからVertex AIを呼び出すため）
resource "google_bigquery_connection" "vertex" {
  project       = var.project_id
  connection_id = "${var.app_name}-vertex-connection"
  location      = var.location
  friendly_name = "Vertex AI Connection"
  description   = "Connection to Vertex AI for ML operations"

  cloud_resource {}

  depends_on = [google_project_service.bigquery_connection]
}

# Vertex AI接続のサービスアカウントにVertex AI User権限を付与
resource "google_project_iam_member" "vertex_connection_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_bigquery_connection.vertex.cloud_resource[0].service_account_id}"
}

# GCSオブジェクトへの読み取り権限を付与
resource "google_storage_bucket_iam_member" "vertex_connection_gcs" {
  bucket = var.pdf_uploads_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_bigquery_connection.vertex.cloud_resource[0].service_account_id}"
}

# Document AI User権限を付与
resource "google_project_iam_member" "vertex_connection_documentai" {
  project = var.project_id
  role    = "roles/documentai.apiUser"
  member  = "serviceAccount:${google_bigquery_connection.vertex.cloud_resource[0].service_account_id}"
}
