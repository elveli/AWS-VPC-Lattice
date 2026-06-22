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
