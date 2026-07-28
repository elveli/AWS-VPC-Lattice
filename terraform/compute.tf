# ==============================================================================
# AWS VPC Lattice - Demo compute (EC2 targets + client) & supporting IAM
# File: compute.tf
#
# Minimal, SSM-only compute (no SSH keys, nothing open to the internet inbound)
# so requests actually flow end-to-end through the resources defined in
# lattice_network.tf / lattice_services.tf, instead of just existing on paper.
# ==============================================================================

data "aws_ssm_parameter" "al2023_consumer" {
  provider = aws.consumer
  name     = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

data "aws_ssm_parameter" "al2023_provider" {
  provider = aws.provider
  name     = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# ------------------------------------------------------------------------------
# IAM - Consumer account (Account A)
# ------------------------------------------------------------------------------

# Role for the client EC2 instance: SSM access, direct Invoke on Orders, and
# permission to assume FinanceServiceRole to reach Payments.
resource "aws_iam_role" "client" {
  provider = aws.consumer
  name     = "lattice-demo-client-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "Lattice-Demo-Client-Role" }
}

resource "aws_iam_role_policy_attachment" "client_ssm" {
  provider   = aws.consumer
  role       = aws_iam_role.client.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "client_invoke_orders" {
  provider = aws.consumer
  name     = "invoke-orders-and-assume-finance-role"
  role     = aws_iam_role.client.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "InvokeOrdersDirectly"
        Effect   = "Allow"
        Action   = "vpc-lattice-svcs:Invoke"
        Resource = aws_vpclattice_service.orders.arn
      },
      {
        Sid      = "AssumeFinanceRoleForPayments"
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.finance_service.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "client" {
  provider = aws.consumer
  name     = "lattice-demo-client-profile"
  role     = aws_iam_role.client.name
}

# Named FinanceServiceRole to match the ARN that lattice_services.tf's
# payments_svc_auth policy already grants Invoke to - only assumable by
# client_role, and only allowed to call Payments. Demonstrates the same
# allow/deny + assumed-role mechanics the in-app IAM Policy Lab simulates,
# but against a real IAM role.
resource "aws_iam_role" "finance_service" {
  provider = aws.consumer
  name     = "FinanceServiceRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = aws_iam_role.client.arn }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "Finance-Service-Role" }
}

resource "aws_iam_role_policy" "finance_invoke_payments" {
  provider = aws.consumer
  name     = "invoke-payments"
  role     = aws_iam_role.finance_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokePaymentsOnly"
      Effect   = "Allow"
      Action   = "vpc-lattice-svcs:Invoke"
      Resource = aws_vpclattice_service.payments.arn
    }]
  })
}

# ------------------------------------------------------------------------------
# IAM - Provider account (Account B): target instances only need SSM access,
# they serve HTTP and don't call anything themselves.
# ------------------------------------------------------------------------------

resource "aws_iam_role" "app" {
  provider = aws.provider
  name     = "lattice-demo-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "Lattice-Demo-App-Role" }
}

resource "aws_iam_role_policy_attachment" "app_ssm" {
  provider   = aws.provider
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app" {
  provider = aws.provider
  name     = "lattice-demo-app-profile"
  role     = aws_iam_role.app.name
}

# ------------------------------------------------------------------------------
# EC2 - Consumer VPC: SigV4 client used to invoke both services and demonstrate
# the auth allow/deny + assumed-role flow. Connect via SSM (no SSH/keys), then
# run the helper scripts dropped into /opt/lattice-demo by the user_data below.
# ------------------------------------------------------------------------------

resource "aws_instance" "client" {
  provider                    = aws.consumer
  ami                         = data.aws_ssm_parameter.al2023_consumer.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.consumer_subnets[0].id
  vpc_security_group_ids      = [aws_security_group.client_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.client.name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/templates/client_user_data.sh.tpl", {
    region           = var.aws_region
    orders_domain    = aws_vpclattice_service.orders.dns_entry[0].domain_name
    payments_domain  = aws_vpclattice_service.payments.dns_entry[0].domain_name
    finance_role_arn = aws_iam_role.finance_service.arn
  })

  tags = { Name = "Consumer-Client" }
}

# ------------------------------------------------------------------------------
# EC2 - Order & Payment VPCs: real HTTP targets behind the existing target
# groups (orders_v1 / payments_v1 in lattice_services.tf), each serving a
# distinguishing response body so canary routing is visibly observable.
# ------------------------------------------------------------------------------

resource "aws_instance" "order_app" {
  provider                    = aws.provider
  ami                         = data.aws_ssm_parameter.al2023_provider.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.order_subnets[0].id
  vpc_security_group_ids      = [aws_security_group.order_app_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/templates/app_user_data.sh.tpl", {
    service_name = "Orders v1 (EC2)"
    health_path  = "/health"
  })

  tags = { Name = "Order-App" }
}

resource "aws_instance" "payment_app" {
  provider                    = aws.provider
  ami                         = data.aws_ssm_parameter.al2023_provider.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.payment_subnets[0].id
  vpc_security_group_ids      = [aws_security_group.payment_app_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/templates/app_user_data.sh.tpl", {
    service_name = "Payments v1 (EC2)"
    health_path  = "/ping"
  })

  tags = { Name = "Payment-App" }
}

# ------------------------------------------------------------------------------
# Register the EC2 targets into the existing (IP-type) target groups
# ------------------------------------------------------------------------------

resource "aws_vpclattice_target_group_attachment" "orders_v1" {
  provider                = aws.provider
  target_group_identifier = aws_vpclattice_target_group.orders_v1.id

  target {
    id   = aws_instance.order_app.private_ip
    port = 80
  }
}

resource "aws_vpclattice_target_group_attachment" "payments_v1" {
  provider                = aws.provider
  target_group_identifier = aws_vpclattice_target_group.payments_v1.id

  target {
    id   = aws_instance.payment_app.private_ip
    port = 80
  }
}
