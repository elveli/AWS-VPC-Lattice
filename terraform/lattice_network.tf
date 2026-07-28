# ==============================================================================
# AWS VPC Lattice - Service Network Setup & Sharing (Cross-Account & IAM Auth)
# File: lattice_network.tf
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. CREATE SERVICE NETWORK (Account B - Provider)
# ------------------------------------------------------------------------------
resource "aws_vpclattice_service_network" "prod_network" {
  provider  = aws.provider
  name      = "corporate-prod-service-network"
  auth_type = "AWS_IAM" # Enforce AWS IAM (SigV4) Auth on the entire Service Network!

  tags = {
    Name = "Corporate-Prod-Service-Network"
  }
}

# ------------------------------------------------------------------------------
# 2. ASSOCIATE PROVIDER VPCS TO SERVICE NETWORK (Account B)
# ------------------------------------------------------------------------------
resource "aws_vpclattice_service_network_vpc_association" "order_vpc_association" {
  provider                   = aws.provider
  vpc_identifier             = aws_vpc.order.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
  security_group_ids         = [aws_security_group.order_app_sg.id] # Optionally apply security groups for VPC boundaries

  tags = {
    Name = "Order-VPC-ServiceNetwork-Assoc"
  }
}

resource "aws_vpclattice_service_network_vpc_association" "payment_vpc_association" {
  provider                   = aws.provider
  vpc_identifier             = aws_vpc.payment.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
  security_group_ids         = [aws_security_group.payment_app_sg.id]

  tags = {
    Name = "Payment-VPC-ServiceNetwork-Assoc"
  }
}

# ------------------------------------------------------------------------------
# 3. CONFIGURE SERVICE NETWORK AUTH POLICY (Account B)
# Allows authenticated traffic from the consumer account, while blocking anonymous.
# ------------------------------------------------------------------------------
resource "aws_vpclattice_auth_policy" "sn_policy" {
  provider            = aws.provider
  resource_identifier = aws_vpclattice_service_network.prod_network.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountAuthenticatedAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${var.consumer_account_id}:root" # Authorize Account A root or specific roles/tasks
          ]
        }
        Action   = "vpc-lattice-svcs:Invoke"
        Resource = "*" # Applies to all services registered inside this Service Network
        Condition = {
          StringEquals = {
            "vpc-lattice-svcs:SourceVpc" = [aws_vpc.consumer.id] # Limit traffic specifically to our Consumer VPC!
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 4. CROSS-ACCOUNT SHARING VIA AWS RESOURCE ACCESS MANAGER (RAM)
# Account B signs and shares, Account A accepts and associates
# ------------------------------------------------------------------------------

# Create RAM Resource Share for the Lattice Service Network
resource "aws_ram_resource_share" "lattice_share" {
  provider                  = aws.provider
  name                      = "vpc-lattice-shared-service-network"
  allow_external_principals = true

  tags = {
    Name = "VPC-Lattice-RAM-Share"
  }
}

# Associate Lattice Service Network with AWS RAM
resource "aws_ram_resource_association" "lattice_network_association" {
  provider           = aws.provider
  resource_arn       = aws_vpclattice_service_network.prod_network.arn
  resource_share_arn = aws_ram_resource_share.lattice_share.arn
}

# Share with the Consumer Account ID (Account A)
resource "aws_ram_principal_association" "consumer_account_association" {
  provider           = aws.provider
  principal          = var.consumer_account_id
  resource_share_arn = aws_ram_resource_share.lattice_share.arn
}

# These two accounts aren't assumed to be in the same AWS Organization, so the
# invitation RAM sends the consumer account isn't auto-accepted — without this,
# the service network stays invisible from the consumer side and
# consumer_vpc_association below fails with ResourceNotFoundException.
resource "aws_ram_resource_share_accepter" "consumer_accept" {
  provider  = aws.consumer
  share_arn = aws_ram_resource_share.lattice_share.arn

  depends_on = [
    aws_ram_principal_association.consumer_account_association,
    aws_ram_resource_association.lattice_network_association
  ]
}

# ==============================================================================
# 5. ASSOCIATE CONSUMER VPC TO THE SHARED SERVICE NETWORK (Account A)
# Once the invitation above is accepted, Consumer VPC (Account A) can link
# directly to the Service Network ID owned by Account B.
# ==============================================================================
resource "aws_vpclattice_service_network_vpc_association" "consumer_vpc_association" {
  provider                   = aws.consumer
  vpc_identifier             = aws_vpc.consumer.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id
  security_group_ids         = [aws_security_group.client_sg.id]

  depends_on = [
    aws_ram_resource_share_accepter.consumer_accept
  ]

  tags = {
    Name = "Consumer-VPC-ServiceNetwork-Assoc"
  }
}
