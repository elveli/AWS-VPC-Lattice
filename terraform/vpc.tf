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

# AWS's own managed prefix lists for VPC Lattice's link-local address ranges -
# referenced instead of hardcoded CIDRs since they're the authoritative source
# (each covers more than just the well-known 169.254.171.0/24 / fc00:ec2:80::/64
# ranges quoted in AWS's docs - see the ingress rules below that use them).
data "aws_ec2_managed_prefix_list" "vpc_lattice_ipv4_consumer" {
  provider = aws.consumer
  name     = "com.amazonaws.${var.aws_region}.vpc-lattice"
}

data "aws_ec2_managed_prefix_list" "vpc_lattice_ipv6_consumer" {
  provider = aws.consumer
  name     = "com.amazonaws.${var.aws_region}.ipv6.vpc-lattice"
}

data "aws_ec2_managed_prefix_list" "vpc_lattice_ipv4_provider" {
  provider = aws.provider
  name     = "com.amazonaws.${var.aws_region}.vpc-lattice"
}

data "aws_ec2_managed_prefix_list" "vpc_lattice_ipv6_provider" {
  provider = aws.provider
  name     = "com.amazonaws.${var.aws_region}.ipv6.vpc-lattice"
}

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
  provider                = aws.consumer
  count                   = 2
  vpc_id                  = aws_vpc.consumer.id
  cidr_block              = cidrsubnet(var.consumer_vpc_cidr, 8, count.index)
  availability_zone       = "${var.aws_region}${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true

  tags = {
    Name = "Consumer-Subnet-${count.index}"
  }
}

# No NAT Gateway: the client instance gets a public IP behind an Internet
# Gateway purely for outbound SSM/package-manager traffic (cost avoidance —
# NAT Gateway's hourly + per-GB charge is unnecessary for this learning stack).
resource "aws_internet_gateway" "consumer" {
  provider = aws.consumer
  vpc_id   = aws_vpc.consumer.id

  tags = {
    Name = "Consumer-IGW"
  }
}

resource "aws_route_table" "consumer_public" {
  provider = aws.consumer
  vpc_id   = aws_vpc.consumer.id

  # IPv4 only: these VPCs don't have an Amazon-provided IPv6 CIDR block
  # associated, so there's no IPv6 target to route (the security groups'
  # IPv6 rules are opportunistic/no-op without one).
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.consumer.id
  }

  tags = {
    Name = "Consumer-Public-RT"
  }
}

resource "aws_route_table_association" "consumer_public" {
  provider       = aws.consumer
  count          = length(aws_subnet.consumer_subnets)
  subnet_id      = aws_subnet.consumer_subnets[count.index].id
  route_table_id = aws_route_table.consumer_public.id
}

# Security group on the client EC2 instance in the Consumer VPC
resource "aws_security_group" "client_sg" {
  provider    = aws.consumer
  name        = "client-instance-sg"
  description = "Allows outbound traffic for Lattice HTTP/HTTPS requests"
  vpc_id      = aws_vpc.consumer.id

  # This SG doubles as consumer_vpc_association's security_group_ids in
  # lattice_network.tf - that association's enforcement point isn't a normal
  # stateful EC2 ENI, so return traffic from VPC Lattice needs an explicit
  # ingress rule or the client's TCP connections hang waiting for a SYN-ACK
  # that gets silently dropped. Mirror of the ingress rules on
  # order_app_sg/payment_app_sg below (same prefix lists, their port 80).
  ingress {
    description     = "Allow VPC Lattice HTTPS return traffic (IPv4)"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv4_consumer.id]
  }

  ingress {
    description     = "Allow VPC Lattice HTTPS return traffic (IPv6)"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv6_consumer.id]
  }

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
  provider                = aws.provider
  count                   = 2
  vpc_id                  = aws_vpc.order.id
  cidr_block              = cidrsubnet(var.order_service_vpc_cidr, 8, count.index)
  availability_zone       = "${var.aws_region}${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true

  tags = {
    Name = "Order-Subnet-${count.index}"
  }
}

resource "aws_internet_gateway" "order" {
  provider = aws.provider
  vpc_id   = aws_vpc.order.id

  tags = {
    Name = "Order-IGW"
  }
}

resource "aws_route_table" "order_public" {
  provider = aws.provider
  vpc_id   = aws_vpc.order.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.order.id
  }

  tags = {
    Name = "Order-Public-RT"
  }
}

resource "aws_route_table_association" "order_public" {
  provider       = aws.provider
  count          = length(aws_subnet.order_subnets)
  subnet_id      = aws_subnet.order_subnets[count.index].id
  route_table_id = aws_route_table.order_public.id
}

# The Target SG must allow port 80/443 from AWS's managed VPC Lattice prefix
# lists (data.aws_ec2_managed_prefix_list.vpc_lattice_*_provider above).
# Also require local VPC routing for health checks.
resource "aws_security_group" "order_app_sg" {
  provider    = aws.provider
  name        = "order-app-sg"
  description = "Allows inbound traffic only from VPC Lattice link-local prefix and local health checks"
  vpc_id      = aws_vpc.order.id

  ingress {
    description     = "Allow IPv4 VPC Lattice HTTP traffic"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv4_provider.id]
  }

  ingress {
    description     = "Allow IPv6 VPC Lattice HTTP traffic"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv6_provider.id]
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
  provider                = aws.provider
  count                   = 2
  vpc_id                  = aws_vpc.payment.id
  cidr_block              = cidrsubnet(var.payment_service_vpc_cidr, 8, count.index)
  availability_zone       = "${var.aws_region}${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true

  tags = {
    Name = "Payment-Subnet-${count.index}"
  }
}

resource "aws_internet_gateway" "payment" {
  provider = aws.provider
  vpc_id   = aws_vpc.payment.id

  tags = {
    Name = "Payment-IGW"
  }
}

resource "aws_route_table" "payment_public" {
  provider = aws.provider
  vpc_id   = aws_vpc.payment.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.payment.id
  }

  tags = {
    Name = "Payment-Public-RT"
  }
}

resource "aws_route_table_association" "payment_public" {
  provider       = aws.provider
  count          = length(aws_subnet.payment_subnets)
  subnet_id      = aws_subnet.payment_subnets[count.index].id
  route_table_id = aws_route_table.payment_public.id
}

resource "aws_security_group" "payment_app_sg" {
  provider    = aws.provider
  name        = "payment-app-sg"
  description = "Allows inbound traffic only from VPC Lattice link-local prefix"
  vpc_id      = aws_vpc.payment.id

  ingress {
    description     = "Allow IPv4 VPC Lattice HTTP traffic"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv4_provider.id]
  }

  ingress {
    description     = "Allow IPv6 VPC Lattice HTTP traffic"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.vpc_lattice_ipv6_provider.id]
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
