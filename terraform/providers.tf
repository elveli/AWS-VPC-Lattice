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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

# Provider for Account A: The Consumer Account (e.g., Client Microservice)
# Reads credentials from the local AWS CLI profile named by var.consumer_profile
# (`aws configure --profile <name>`) — no cross-account trust required.
provider "aws" {
  alias   = "consumer"
  region  = var.aws_region
  profile = var.consumer_profile

  default_tags {
    tags = {
      Environment = "Learning"
      Account     = "Consumer-A"
      Project     = "VPC-Lattice-Showcase"
      ManagedBy   = "Terraform"
      Ephemeral   = "true"
    }
  }
}

# Provider for Account B: The Provider Account (e.g., Core Services: Order, Payment)
# Reads credentials from the local AWS CLI profile named by var.provider_profile.
provider "aws" {
  alias   = "provider"
  region  = var.aws_region
  profile = var.provider_profile

  default_tags {
    tags = {
      Environment = "Learning"
      Account     = "Provider-B"
      Project     = "VPC-Lattice-Showcase"
      ManagedBy   = "Terraform"
      Ephemeral   = "true"
    }
  }
}
