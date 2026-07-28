# ==============================================================================
# AWS VPC Lattice - variables.tf
# ==============================================================================

variable "aws_region" {
  type        = string
  description = "AWS region for the deployments"
  default     = "us-east-1"
}

variable "consumer_account_id" {
  type        = string
  description = "AWS Account ID for the Consumer (Account A)"
  default     = "111111111111"
}

variable "provider_account_id" {
  type        = string
  description = "AWS Account ID for the Service Provider (Account B)"
  default     = "222222222222"
}

# --- Local AWS CLI profile names used to authenticate each provider block ---
variable "consumer_profile" {
  type        = string
  description = "AWS CLI named profile with credentials for the Consumer account (Account A)"
  default     = "consumer"
}

variable "provider_profile" {
  type        = string
  description = "AWS CLI named profile with credentials for the Provider account (Account B)"
  default     = "provider"
}

# --- Compute sizing ---
variable "instance_type" {
  type        = string
  description = "EC2 instance type for the demo client/target instances"
  default     = "t3.micro"
}

# --- CIDR Blocks for separate isolation ---
variable "consumer_vpc_cidr" {
  type        = string
  description = "CIDR block for the Consumer VPC"
  default     = "10.100.0.0/16"
}

variable "order_service_vpc_cidr" {
  type        = string
  description = "CIDR block for the Order Service VPC (Provider Account B)"
  default     = "10.200.0.0/16"
}

variable "payment_service_vpc_cidr" {
  type        = string
  description = "CIDR block for the Payment Service VPC (Provider Account B)"
  default     = "10.250.0.0/16"
}
