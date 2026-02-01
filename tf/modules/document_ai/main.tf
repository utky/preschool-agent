# Document AI API を有効化
resource "google_project_service" "documentai" {
  project = var.project_id
  service = "documentai.googleapis.com"
}

# Document OCR プロセッサー
resource "google_document_ai_processor" "ocr" {
  project      = var.project_id
  location     = var.location
  display_name = "${var.app_name}-ocr-processor"
  type         = "OCR_PROCESSOR"

  depends_on = [google_project_service.documentai]
}
