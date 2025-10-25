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
