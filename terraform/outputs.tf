# ==============================================================================
# AWS VPC Lattice - outputs.tf
# ==============================================================================

output "service_network_arn" {
  description = "The ARN of the VPC Lattice Service Network"
  value       = aws_vpclattice_service_network.prod_network.arn
}

output "service_network_id" {
  description = "The ID of the VPC Lattice Service Network"
  value       = aws_vpclattice_service_network.prod_network.id
}

output "orders_service_arn" {
  description = "The ARN of the Orders Lattice Service"
  value       = aws_vpclattice_service.orders.arn
}

output "orders_service_dns_name" {
  description = "The auto-generated Lattice DNS name for the Orders Service"
  value       = aws_vpclattice_service.orders.dns_entry[0].domain_name
}

output "payments_service_arn" {
  description = "The ARN of the Payments Lattice Service"
  value       = aws_vpclattice_service.payments.arn
}

output "payments_service_dns_name" {
  description = "The auto-generated Lattice DNS name for the Payments Service"
  value       = aws_vpclattice_service.payments.dns_entry[0].domain_name
}

output "client_instance_id" {
  description = "SSM into this instance and run the scripts in /opt/lattice-demo (see terraform/DEPLOYING.md)"
  value       = aws_instance.client.id
}

output "connect_to_client" {
  description = "Command to open an SSM session on the client instance"
  value       = "aws ssm start-session --target ${aws_instance.client.id} --profile ${var.consumer_profile} --region ${var.aws_region}"
}

output "order_app_instance_id" {
  description = "The Orders v1 target EC2 instance ID"
  value       = aws_instance.order_app.id
}

output "payment_app_instance_id" {
  description = "The Payments v1 target EC2 instance ID"
  value       = aws_instance.payment_app.id
}

# --- Below: consumed by Makefile targets, not the app UI, so the AWS CLI
# commands it runs against the deployed stack don't need var/tfvars parsing ---

output "aws_region" {
  description = "Region the stack was deployed to (Makefile default)"
  value       = var.aws_region
}

output "consumer_profile" {
  description = "Local AWS CLI profile name for the Consumer account (Makefile default)"
  value       = var.consumer_profile
}

output "provider_profile" {
  description = "Local AWS CLI profile name for the Provider account (Makefile default)"
  value       = var.provider_profile
}

output "orders_listener_id" {
  description = "The Orders service's listener ID (for inspecting/adjusting canary weights)"
  value       = aws_vpclattice_listener.orders.listener_id
}

output "orders_v1_target_group_id" {
  description = "The Orders v1 (EC2/IP) target group ID"
  value       = aws_vpclattice_target_group.orders_v1.id
}

output "orders_v2_target_group_id" {
  description = "The Orders v2 (Lambda) target group ID"
  value       = aws_vpclattice_target_group.orders_v2.id
}

output "payments_v1_target_group_id" {
  description = "The Payments v1 (EC2/IP) target group ID"
  value       = aws_vpclattice_target_group.payments_v1.id
}
