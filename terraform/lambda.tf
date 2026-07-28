# ==============================================================================
# AWS VPC Lattice - Serverless target for the Orders v2 target group
# File: lambda.tf
# ==============================================================================

data "archive_file" "orders_v2" {
  type        = "zip"
  source_file = "${path.module}/lambda_src/orders_v2/handler.py"
  output_path = "${path.module}/lambda_src/orders_v2.zip"
}

resource "aws_iam_role" "orders_v2_lambda" {
  provider = aws.provider
  name     = "orders-v2-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "Orders-v2-Lambda-Role" }
}

resource "aws_iam_role_policy_attachment" "orders_v2_lambda_logs" {
  provider   = aws.provider
  role       = aws_iam_role.orders_v2_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "orders_v2" {
  provider         = aws.provider
  function_name    = "orders-v2-handler"
  role             = aws_iam_role.orders_v2_lambda.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  memory_size      = 128
  timeout          = 5
  filename         = data.archive_file.orders_v2.output_path
  source_code_hash = data.archive_file.orders_v2.output_base64sha256

  tags = { Name = "Orders-v2-Lambda" }
}

# Let VPC Lattice invoke the function only via the orders_v2 target group.
resource "aws_lambda_permission" "orders_v2_lattice" {
  provider      = aws.provider
  statement_id  = "AllowVpcLatticeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.orders_v2.function_name
  principal     = "vpc-lattice.amazonaws.com"
  source_arn    = aws_vpclattice_target_group.orders_v2.arn
}

resource "aws_vpclattice_target_group_attachment" "orders_v2" {
  provider                = aws.provider
  target_group_identifier = aws_vpclattice_target_group.orders_v2.id

  target {
    id = aws_lambda_function.orders_v2.arn
  }

  depends_on = [aws_lambda_permission.orders_v2_lattice]
}
