terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
    }
    random = {
      source = "hashicorp/random"
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
    "environment" = "production",
    "managed-by"  = "terraform"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  default_labels = {
    "environment" = "production",
    "managed-by"  = "terraform"
  }
}
