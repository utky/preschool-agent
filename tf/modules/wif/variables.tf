variable "project_id" {
  type        = string
  description = "Google CloudのプロジェクトID"
}

variable "prefix" {
  type        = string
  description = "A prefix for the resource names."
  default     = "gh-actions"
}

variable "github_repo" {
  type        = string
  description = "The GitHub repository in the format 'owner/repo'."
}

variable "service_account_roles" {
  type        = list(string)
  description = "A list of roles to grant to the service account."
  default = [
    "roles/editor" # Start with a broad role, can be refined later
  ]
}
