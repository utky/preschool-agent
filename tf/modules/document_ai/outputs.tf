output "processor_id" {
  value       = google_document_ai_processor.ocr.id
  description = "Document AI OCR プロセッサーのID"
}

output "processor_name" {
  value       = google_document_ai_processor.ocr.name
  description = "Document AI OCR プロセッサーのリソース名"
}
