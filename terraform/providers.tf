# ==============================================================================
# AWS VPC Lattice - Multi-Account & Multi-VPC Architecture
# File: providers.tf
# ==============================================================================

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Provider for Account A: The Consumer Account (e.g., Client Microservice)
provider "aws" {
  alias  = "consumer"
  region = var.aws_region

  # In a real setup, assume role into Account A (111111111111)
  # assume_role {
  #   role_arn = "arn:aws:iam::111111111111:role/CrossAccountLatticeTerraformRole"
  # }

  default_tags {
    tags = {
      Environment = "Production"
      Account     = "Consumer-A"
      Project     = "VPC-Lattice-Showcase"
      ManagedBy   = "Terraform"
    }
  }
}

# Provider for Account B: The Provider Account (e.g., Core Services: Order, Payment)
provider "aws" {
  alias  = "provider"
  region = var.aws_region

  # In a real setup, assume role into Account B (222222222222)
  # assume_role {
  #   role_arn = "arn:aws:iam::222222222222:role/CrossAccountLatticeTerraformRole"
  # }

  default_tags {
    tags = {
      Environment = "Production"
      Account     = "Provider-B"
      Project     = "VPC-Lattice-Showcase"
      ManagedBy   = "Terraform"
    }
  }
}
