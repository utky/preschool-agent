terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
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
    "environment" = "production",
    "managed-by"  = "terraform"
  }
}

module "app" {
  source     = "../../modules/app"
  project_id = var.project_id
  region     = var.region
}

module "iap" {
  source                 = "../../modules/iap"
  project_id             = var.project_id
  region                 = var.region
  cloud_run_service_name = module.app.service_name
  iap_allowed_users      = var.iap_allowed_users
}
