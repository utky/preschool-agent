variable "project_id" {
  type        = string
  description = "The ID of the Google Cloud project."
}

variable "region" {
  type        = string
  description = "The Google Cloud region."
}

variable "cloud_run_service_name" {
  type        = string
  description = "The name of the Cloud Run service."
}

variable "iap_allowed_users" {
  type        = list(string)
  description = "A list of user emails to allow access via IAP."
  default     = []
}