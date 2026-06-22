# ==============================================================================
# AWS VPC Lattice - VPC Setup
# File: vpc.tf
# Sets up three distinct VPCs:
# 1. Consumer VPC (Account A)
# 2. Order VPC (Account B)
# 3. Payment VPC (Account B)
# ==============================================================================

# ==============================================================================
# 1. CONSUMER VPC (Account A - Client calling services)
# ==============================================================================

resource "aws_vpc" "consumer" {
  provider             = aws.consumer
  cidr_block           = var.consumer_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "Consumer-VPC"
  }
}

resource "aws_subnet" "consumer_subnets" {
  provider          = aws.consumer
  count             = 2
  vpc_id            = aws_vpc.consumer.id
  cidr_block        = cidrsubnet(var.consumer_vpc_cidr, 8, count.index)
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name = "Consumer-Subnet-${count.index}"
  }
}

# Security group on the client EC2 instance in the Consumer VPC
resource "aws_security_group" "client_sg" {
  provider    = aws.consumer
  name        = "client-instance-sg"
  description = "Allows outbound traffic for Lattice HTTP/HTTPS requests"
  vpc_id      = aws_vpc.consumer.id

  # Allow all outbound (outbound traffic to VPC Lattice relies on standard routing table lookup,
  # but security groups must allow outbound to any address, as DNS resolves to link-local addresses).
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "Client-Instance-SG"
  }
}


# ==============================================================================
# 2. ORDER SERVICE VPC (Account B - Order microservice target VPC)
# ==============================================================================

resource "aws_vpc" "order" {
  provider             = aws.provider
  cidr_block           = var.order_service_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "Order-Service-VPC"
  }
}

resource "aws_subnet" "order_subnets" {
  provider          = aws.provider
  count             = 2
  vpc_id            = aws_vpc.order.id
  cidr_block        = cidrsubnet(var.order_service_vpc_cidr, 8, count.index)
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name = "Order-Subnet-${count.index}"
  }
}

# The Target SG must allow port 80/443 from AWS Lattice Managed IP ranges:
# IPv4: 169.254.171.0/24
# IPv6: fc00:ec2:80::/64
# Also require local VPC routing for health checks.
resource "aws_security_group" "order_app_sg" {
  provider    = aws.provider
  name        = "order-app-sg"
  description = "Allows inbound traffic only from VPC Lattice link-local prefix and local health checks"
  vpc_id      = aws_vpc.order.id

  ingress {
    description = "Allow IPv4 VPC Lattice HTTP traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["169.254.171.0/24"]
  }

  ingress {
    description      = "Allow IPv6 VPC Lattice HTTP traffic"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    ipv6_cidr_blocks = ["fc00:ec2:80::/64"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Order-App-SG"
  }
}


# ==============================================================================
# 3. PAYMENT SERVICE VPC (Account B - Payment microservice target VPC)
# ==============================================================================

resource "aws_vpc" "payment" {
  provider             = aws.provider
  cidr_block           = var.payment_service_vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "Payment-Service-VPC"
  }
}

resource "aws_subnet" "payment_subnets" {
  provider          = aws.provider
  count             = 2
  vpc_id            = aws_vpc.payment.id
  cidr_block        = cidrsubnet(var.payment_service_vpc_cidr, 8, count.index)
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"

  tags = {
    Name = "Payment-Subnet-${count.index}"
  }
}

resource "aws_security_group" "payment_app_sg" {
  provider    = aws.provider
  name        = "payment-app-sg"
  description = "Allows inbound traffic only from VPC Lattice link-local prefix"
  vpc_id      = aws_vpc.payment.id

  ingress {
    description = "Allow IPv4 VPC Lattice HTTP traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["169.254.171.0/24"]
  }

  ingress {
    description      = "Allow IPv6 VPC Lattice HTTP traffic"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    ipv6_cidr_blocks = ["fc00:ec2:80::/64"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Payment-App-SG"
  }
}
