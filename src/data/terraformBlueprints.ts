import { TerraformFile } from "../types";

export const terraformBlueprints: TerraformFile[] = [
  {
    name: "providers.tf",
    code: `# ==============================================================================
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

  default_tags {
    tags = {
      Environment = "Production"
      Account     = "Provider-B"
      Project     = "VPC-Lattice-Showcase"
      ManagedBy   = "Terraform"
    }
  }
}`,
    description: "Multi-provider configuration modeling distinct AWS accounts (Consumer Account A: 111111111111 and Prod Service Account B: 222222222222) via AWS providers with custom alias markers.",
    highlights: [
      { line: 20, concept: "Alias Provider", text: "Sets up isolated client configuration mapping to Account A." },
      { line: 36, concept: "Alias Provider", text: "Sets up isolated hosting environment targeting Account B." }
    ]
  },
  {
    name: "variables.tf",
    code: `# ==============================================================================
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
`,
    description: "Definition of core network boundaries, addressing ranges, and account principal IDs ensuring complete zero IP-overlap requirements.",
    highlights: [
      { line: 9, concept: "Multi-Account Boundaries", text: "Tracks Account A which acts as the consumer request client." },
      { line: 15, concept: "Account Isolation", text: "Tracks Account B hosting Orders and Payments microservices." }
    ]
  },
  {
    name: "vpc.tf",
    code: `# ==============================================================================
# AWS VPC Lattice - VPC Setup
# File: vpc.tf
# Sets up three distinct VPCs
# ==============================================================================

# --- CONSUMER VPC (Account A) ---
resource "aws_vpc" "consumer" {
  provider             = aws.consumer
  cidr_block           = var.consumer_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_subnet" "consumer_subnets" {
  provider          = aws.consumer
  count             = 2
  vpc_id            = aws_vpc.consumer.id
  cidr_block        = cidrsubnet(var.consumer_vpc_cidr, 8, count.index)
  availability_zone = "\${var.aws_region}\${count.index == 0 ? "a" : "b"}"
}

# Security group on client instance
resource "aws_security_group" "client_sg" {
  provider    = aws.consumer
  name        = "client-instance-sg"
  vpc_id      = aws_vpc.consumer.id
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# --- ORDER SERVICE VPC (Account B) ---
resource "aws_vpc" "order" {
  provider             = aws.provider
  cidr_block           = var.order_service_vpc_cidr
  enable_dns_hostnames = true
}

# Target SGs must explicitly allow Link-Local Prefix traffic from Lattice:
# 169.254.171.0/24 (IPv4) & fc00:ec2:80::/64 (IPv6)
resource "aws_security_group" "order_app_sg" {
  provider    = aws.provider
  name        = "order-app-sg"
  vpc_id      = aws_vpc.order.id

  ingress {
    description = "Allow IPv4 VPC Lattice HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["169.254.171.0/24"]
  }

  ingress {
    description      = "Allow IPv6 VPC Lattice HTTP"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    ipv6_cidr_blocks = ["fc00:ec2:80::/64"]
  }
}
`,
    description: "Configures network subnets alongside target Security Groups explicitly designed to allow ingress traffic exclusively from VPC Lattice link-local routing ranges (169.254.171.0/24).",
    highlights: [
      { line: 49, concept: "Lattice Link-Local IPv4 ingress", text: "Mandatory security group ingress opening 169.254.171.0/24 for Lattice routing." },
      { line: 57, concept: "Lattice Link-Local IPv6 ingress", text: "Supports modern IPv6 targets routing requests via fc00:ec2:80::/64." }
    ]
  },
  {
    name: "lattice_network.tf",
    code: `# ==============================================================================
# AWS VPC Lattice - Service Network Setup & Sharing (Cross-Account & IAM Auth)
# File: lattice_network.tf
# ==============================================================================

# 1. CREATE SERVICE NETWORK (Account B)
resource "aws_vpclattice_service_network" "prod_network" {
  provider           = aws.provider
  name               = "corporate-prod-service-network"
  auth_type          = "AWS_SIGV4" # Enforce AWS IAM (SigV4) Auth!
}

# 2. ASSOCIATE PROVIDER VPCS (Account B)
resource "aws_vpclattice_service_network_vpc_association" "order_vpc_association" {
  provider           = aws.provider
  vpc_identifier     = aws_vpc.order.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
  security_group_ids = [aws_security_group.order_app_sg.id]
}

# 3. SERVICE NETWORK AUTH POLICY
# Enforces Zero-Trust boundary at entry
resource "aws_vpclattice_auth_policy" "sn_policy" {
  provider     = aws.provider
  resource_arn = aws_vpclattice_service_network.prod_network.arn
  policy       = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCrossAccountAuthenticatedAccess"
        Effect    = "Allow"
        Principal = {
          AWS = ["arn:aws:iam::\${var.consumer_account_id}:root"]
        }
        Action    = "vpc-lattice-svcs:Invoke"
        Resource  = "*"
        Condition = {
          StringEquals = {
            "vpc-lattice-svcs:SourceVpc" = [aws_vpc.consumer.id]
          }
        }
      }
    ]
  })
}

# 4. CROSS-ACCOUNT SHARING VIA AWS RAM
resource "aws_ram_resource_share" "lattice_share" {
  provider                  = aws.provider
  name                      = "vpc-lattice-shared-service-network"
  allow_external_principals = true
}

resource "aws_ram_resource_association" "lattice_network_association" {
  provider           = aws.provider
  resource_arn       = aws_vpclattice_service_network.prod_network.arn
  resource_share_arn = aws_ram_resource_share.lattice_share.arn
}

resource "aws_ram_principal_association" "consumer_account_association" {
  provider           = aws.provider
  principal          = var.consumer_account_id
  resource_share_arn = aws_ram_resource_share.lattice_share.arn
}

# 5. ASSOCIATE CONSUMER VPC (Account A)
resource "aws_vpclattice_service_network_vpc_association" "consumer_vpc_association" {
  provider           = aws.consumer
  vpc_identifier     = aws_vpc.consumer.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
  security_group_ids         = [aws_security_group.client_sg.id]

  depends_on = [
    aws_ram_principal_association.consumer_account_association,
    aws_ram_resource_association.lattice_network_association
  ]
}
`,
    description: "Instantiates a secured service hub, enforces AWS_SIGV4 globally, secures resource sharing across cross-account boundaries via AWS RAM, and aggregates client/provider VPC attachments.",
    highlights: [
      { line: 9, concept: "SigV4 Security", text: "Enables AWS IAM token validation across entire service mesh." },
      { line: 26, concept: "Unified IAM policy", text: "Attaches a multi-account boundary limit restricting actions to Consumer Account VPC requests." },
      { line: 55, concept: "RAM invitation sharing", text: "Synthesizes Resource Access Manager components enabling secure cross-account visibility." }
    ]
  },
  {
    name: "lattice_services.tf",
    code: `# ==============================================================================
# AWS VPC Lattice - Services, Target Groups, Rules, & Auth Policies
# File: lattice_services.tf
# ==============================================================================

# --- MICROSERVICE DESIGNS ---
resource "aws_vpclattice_service" "orders" {
  provider           = aws.provider
  name               = "orders-service"
  auth_type          = "AWS_SIGV4"
}

resource "aws_vpclattice_service" "payments" {
  provider           = aws.provider
  name               = "payments-service"
  auth_type          = "AWS_SIGV4"
}

# --- SERVICE MESH ATTACHMENT ---
resource "aws_vpclattice_service_network_service_association" "orders_assoc" {
  provider                   = aws.provider
  service_identifier         = aws_vpclattice_service.orders.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
}

# --- TARGET GROUPS ---
resource "aws_vpclattice_target_group" "orders_v1" {
  provider = aws.provider
  name     = "orders-v1-tg"
  type     = "IP"
  config {
    vpc_identifier = aws_vpc.order.id
    port           = 80
    protocol       = "HTTP"
  }
}

resource "aws_vpclattice_target_group" "orders_v2" {
  provider = aws.provider
  name     = "orders-v2-lambda-tg"
  type     = "LAMBDA"
}

# --- LISTENERS & MATCHING RULES ---
resource "aws_vpclattice_listener" "orders" {
  provider           = aws.provider
  name               = "orders-listener"
  port               = 80
  protocol           = "HTTP"
  service_identifier = aws_vpclattice_service.orders.id

  # Canary allocation rule
  default_action {
    forward {
      target_groups {
        target_group_identifier = aws_vpclattice_target_group.orders_v1.id
        weight                  = 90
      }
      target_groups {
        target_group_identifier = aws_vpclattice_target_group.orders_v2.id
        weight                  = 10
      }
    }
  }
}

resource "aws_vpclattice_listener_rule" "orders_v2_path_rule" {
  provider            = aws.provider
  name                = "orders-v2-path-rule"
  listener_identifier = aws_vpclattice_listener.orders.id
  service_identifier  = aws_vpclattice_service.orders.id
  priority            = 10

  match {
    http_match {
      path_match {
        match { prefix = "/v2" }
      }
    }
  }
  action {
    forward {
      target_groups {
        target_group_identifier = aws_vpclattice_target_group.orders_v2.id
        weight                  = 100
      }
    }
  }
}

# --- DUAL-DEFENSE FINE-GRAINED POLICIES ---
resource "aws_vpclattice_auth_policy" "payments_svc_auth" {
  provider     = aws.provider
  resource_arn = aws_vpclattice_service.payments.arn
  policy       = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RestrictPaymentsToFinanceRoleOnly"
        Effect    = "Allow"
        Principal = {
          AWS = "arn:aws:iam::\${var.consumer_account_id}:role/FinanceServiceRole"
        }
        Action    = "vpc-lattice-svcs:Invoke"
        Resource  = aws_vpclattice_service.payments.arn
        Condition = {
          StringEquals = { "vpc-lattice-svcs:RequestMethod" = ["POST"] }
        }
      }
    ]
  })
}
`,
    description: "Maps specific microservice entry points, configures nested path routing listeners, configures multi-target groupings (IP Containers & AWS Lambda), and attaches fine-grained JSON authorization parameters.",
    highlights: [
      { line: 55, concept: "Dynamic Weight Routing", text: "Distributes default traffic split: 90% container infrastructure, 10% serverless test block." },
      { line: 68, concept: "Path Routing Override", text: "Forces matching requests containing prefix '/v2' exclusively to serverless targets." },
      { line: 101, concept: "Zero-Trust Authorization block", text: "Secures banking/payments microservice mapping invoking capabilities exclusively to Finance Roles." }
    ]
  },
  {
    name: "outputs.tf",
    code: `# ==============================================================================
# AWS VPC Lattice - outputs.tf
# ==============================================================================

output "service_network_arn" {
  description = "The ARN of the VPC Lattice Service Network"
  value       = aws_vpclattice_service_network.prod_network.arn
}

output "orders_service_dns_name" {
  description = "The auto-generated Lattice DNS name for the Orders Service"
  value       = aws_vpclattice_service.orders.dns_entry[0].domain_name
}

output "payments_service_dns_name" {
  description = "The auto-generated Lattice DNS name for the Payments Service"
  value       = aws_vpclattice_service.payments.dns_entry[0].domain_name
}`,
    description: "Outputs indicating successfully provisioned parameters, returning Service endpoints to resolve within associated client networks.",
    highlights: [
      { line: 11, concept: "Lattice Dynamic DNS", text: "Returns fully qualified DNS endpoint generated by AWS (accessible only in associated VPCs)." }
    ]
  }
];
