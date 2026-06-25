# ==============================================================================
# AWS VPC Lattice - Services, Target Groups, Rules, & Auth Policies
# File: lattice_services.tf
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. DESIGN THE SERVICES (Account B - Provider)
# ------------------------------------------------------------------------------

# Service A: Orders Microservice
resource "aws_vpclattice_service" "orders" {
  provider           = aws.provider
  name               = "orders-service"
  auth_type          = "AWS_IAM" # Double down on IAM (SigV4) authentication at the Service level
  custom_domain_name = "orders.corp.internal"

  tags = {
    Name = "Orders-Service"
  }
}

# Service B: Payments Microservice
resource "aws_vpclattice_service" "payments" {
  provider           = aws.provider
  name               = "payments-service"
  auth_type          = "AWS_IAM"
  custom_domain_name = "payments.corp.internal"

  tags = {
    Name = "Payments-Service"
  }
}

# ------------------------------------------------------------------------------
# 2. ASSOCIATE SERVICES WITH THE SERVICE NETWORK
# ------------------------------------------------------------------------------
resource "aws_vpclattice_service_network_service_association" "orders_assoc" {
  provider                   = aws.provider
  service_identifier         = aws_vpclattice_service.orders.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id

  tags = {
    Name = "Orders-ServiceNetwork-Assoc"
  }
}

resource "aws_vpclattice_service_network_service_association" "payments_assoc" {
  provider                   = aws.provider
  service_identifier         = aws_vpclattice_service.payments.id
  service_network_identifier = aws_vpclattice_service_network.prod_network.id

  tags = {
    Name = "Payments-ServiceNetwork-Assoc"
  }
}

# ------------------------------------------------------------------------------
# 3. DEFINE TARGET GROUPS
# Features weighted container deployments and dynamic Lambda routing
# ------------------------------------------------------------------------------

# Target Group: Orders v1 (Classic Containers / ALB in Order VPC)
resource "aws_vpclattice_target_group" "orders_v1" {
  provider = aws.provider
  name     = "orders-v1-tg"
  type     = "IP" # Can be: IP, INSTANCE, ALB, LAMBDA
  config {
    vpc_identifier  = aws_vpc.order.id
    port            = 80
    protocol        = "HTTP"
    ip_address_type = "IPV4"

    health_check {
      enabled                       = true
      health_check_interval_seconds = 30
      health_check_timeout_seconds  = 5
      healthy_threshold_count       = 2
      unhealthy_threshold_count     = 2
      matcher {
        value = "200"
      }
      path     = "/health"
      port     = 80
      protocol = "HTTP"
    }
  }

  tags = {
    Name = "Orders-v1-TG"
  }
}

# Target Group: Orders v2 Serverless (AWS Lambda in Order VPC)
resource "aws_vpclattice_target_group" "orders_v2" {
  provider = aws.provider
  name     = "orders-v2-lambda-tg"
  type     = "LAMBDA"

  tags = {
    Name = "Orders-v2-Lambda-TG"
  }
}

# Target Group: Payments v1 Production (Containers in Payment VPC)
resource "aws_vpclattice_target_group" "payments_v1" {
  provider = aws.provider
  name     = "payments-v1-tg"
  type     = "IP"
  config {
    vpc_identifier = aws_vpc.payment.id
    port           = 80
    protocol       = "HTTP"

    health_check {
      enabled                       = true
      health_check_interval_seconds = 15
      path                          = "/ping"
      port                          = 80
      protocol                      = "HTTP"
    }
  }

  tags = {
    Name = "Payments-v1-TG"
  }
}

# ------------------------------------------------------------------------------
# 4. LISTENERS AND ADVANCED TRAFFIC ROUTING RULES
# Configures Weighted / Blue-Green Canary routing and Path Matches
# ------------------------------------------------------------------------------

# Listener on Orders: Port 80
resource "aws_vpclattice_listener" "orders" {
  provider           = aws.provider
  name               = "orders-listener"
  port               = 80
  protocol           = "HTTP"
  service_identifier = aws_vpclattice_service.orders.id

  # Default action: 90/10 split between v1 (Containers) and v2 (Lambda Serverless)
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

  tags = {
    Name = "Orders-Listener"
  }
}

# Dynamic Path rule on Orders: Route all `/v2/*` requests strictly to Lambda (Orders v2)
resource "aws_vpclattice_listener_rule" "orders_v2_path_rule" {
  provider            = aws.provider
  name                = "orders-v2-path-rule"
  listener_identifier = aws_vpclattice_listener.orders.id
  service_identifier  = aws_vpclattice_service.orders.id
  priority            = 10

  match {
    http_match {
      path_match {
        match {
          prefix = "/v2"
        }
        case_sensitive = false
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

  tags = {
    Name = "Orders-v2-Path-Rule"
  }
}

# Listener on Payments: Port 80
resource "aws_vpclattice_listener" "payments" {
  provider           = aws.provider
  name               = "payments-listener"
  port               = 80
  protocol           = "HTTP"
  service_identifier = aws_vpclattice_service.payments.id

  default_action {
    forward {
      target_groups {
        target_group_identifier = aws_vpclattice_target_group.payments_v1.id
      }
    }
  }

  tags = {
    Name = "Payments-Listener"
  }
}

# ------------------------------------------------------------------------------
# 5. FINE-GRAINED SERVICE AUTH POLICIES (IAM)
# Realizing Zero Trust Architecture at the Microservice Boundary
# ------------------------------------------------------------------------------

# Orders Auth Policy: Allow full access to any caller from Account A (Consumer)
resource "aws_vpclattice_auth_policy" "orders_svc_auth" {
  provider            = aws.provider
  resource_identifier = aws_vpclattice_service.orders.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowConsumerAccountAccessToOrders"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.consumer_account_id}:root"
        }
        Action   = "vpc-lattice-svcs:Invoke"
        Resource = aws_vpclattice_service.orders.arn
        Condition = {
          # Restrict calls to specific read or creation paths
          StringLike = {
            "vpc-lattice-svcs:RequestMethod" = ["GET", "POST"]
          }
        }
      }
    ]
  })
}

# Payments Auth Policy: High-security constraint!
# Consuming transactions is locked down to a highly privileged "FinanceServiceRole" running in Account A.
resource "aws_vpclattice_auth_policy" "payments_svc_auth" {
  provider            = aws.provider
  resource_identifier = aws_vpclattice_service.payments.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RestrictPaymentsToFinanceRoleOnly"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.consumer_account_id}:role/FinanceServiceRole"
        }
        Action   = "vpc-lattice-svcs:Invoke"
        Resource = aws_vpclattice_service.payments.arn
        Condition = {
          StringEquals = {
            "vpc-lattice-svcs:RequestMethod" = ["POST"]
          }
        }
      }
    ]
  })
}
