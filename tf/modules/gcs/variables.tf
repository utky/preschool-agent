variable "bucket_name" {
  type        = string
  description = "The name of the GCS bucket for Terraform state."
}

variable "location" {
  type        = string
  description = "The location of the GCS bucket."
}
