terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source = "hashicorp/google"
    }
    google-beta = {
      source = "hashicorp/google-beta"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.2"
    }
  }

  backend "gcs" {
    # このバケットは事前に手動で作成しておく必要があります
    bucket = "lofilab-school-agent-tfstate"
    prefix = "terraform/state/production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    "environment"        = "production",
    "managed-by"         = "terraform"
    "terraform-provider" = "google"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  default_labels = {
    "environment"        = "production",
    "managed-by"         = "terraform"
    "terraform-provider" = "google-beta"
  }
}

resource "random_string" "auth_secret" {
  length  = 32
  special = false
}

module "app" {
  source                    = "../../modules/app"
  project_id                = var.project_id
  region                    = var.region
  container_image           = var.container_image
  auth_secret_value         = random_string.auth_secret.result
  allowed_user_emails_value = var.allowed_user_emails_value
}

module "document_ai" {
  source     = "../../modules/document_ai"
  project_id = var.project_id
  # Document AI OCR は asia-northeast1 未対応のため us を使用
  location   = "us"
}

module "bigquery" {
  source                  = "../../modules/bigquery"
  project_id              = var.project_id
  location                = var.region
  pdf_uploads_bucket_name = module.app.pdf_uploads_bucket_name
  seeds_bucket_name       = module.app.seeds_bucket_name
}

module "cloud_run_job" {
  source                     = "../../modules/cloud_run_job"
  project_id                 = var.project_id
  region                     = var.region
  container_image            = var.dbt_container_image
  api_data_bucket_name       = module.app.api_data_bucket_name
  vertex_connection_name     = module.bigquery.vertex_connection_name
  document_ai_processor_path = module.document_ai.processor_name
  seeds_bucket_name          = module.app.seeds_bucket_name
}

module "monitoring" {
  source                            = "../../modules/monitoring"
  project_id                        = var.project_id
  frontend_bucket_name              = module.app.frontend_bucket_name
  alert_email                       = var.alert_email
  # デフォルト: 2048 バイト/秒 (2KB/s)
}

module "scheduler" {
  source       = "../../modules/scheduler"
  project_id   = var.project_id
  region       = var.region
  dbt_job_name = module.cloud_run_job.job_name
}
