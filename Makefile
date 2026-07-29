# ==============================================================================
# AWS VPC Lattice - Makefile
#
# Convenience wrapper around:
#   1. The Terraform lifecycle for this stack (init/plan/apply/destroy)
#   2. Real `aws vpc-lattice` / `aws ram` control-plane calls against whatever
#      is actually deployed, with IDs/ARNs pulled live from `terraform output`
#      instead of pasted in by hand.
#   3. Real data-plane traffic (SigV4-signed requests) via `aws ssm send-command`
#      on the client EC2 instance, since the Lattice service DNS names only
#      resolve from inside the consumer VPC — see DEPLOYING.md.
#
# Everything here talks to real AWS accounts and (for demo-* / shift-canary)
# generates billable requests or mutates live infrastructure. It's a shortcut
# for typing out the same commands from DEPLOYING.md, not a fire-and-forget
# script — read a target's recipe before running it if you're unsure.
#
# Requires: this stack already `terraform apply`-ed, both AWS CLI profiles
# configured (see terraform/terraform.tfvars.example), and the AWS CLI +
# Session Manager plugin installed for the demo-*/connect targets.
#
# Run from the repo root — TF below points at terraform/ via -chdir so state
# and outputs resolve correctly regardless of your current directory.
# ==============================================================================

TF := terraform -chdir=terraform

# Falls back to the tfvars.example defaults if terraform output isn't
# available yet (e.g. before the first apply — `terraform output -raw` exits
# 0 with empty stdout in that case, not an error, hence the shell-side ${:-}
# default rather than a `|| echo` fallback); override on the command line
# with `make <target> PROVIDER_PROFILE=foo`.
REGION           = $(shell out=$$($(TF) output -raw aws_region 2>/dev/null); echo "$${out:-us-east-1}")
CONSUMER_PROFILE = $(shell out=$$($(TF) output -raw consumer_profile 2>/dev/null); echo "$${out:-consumer}")
PROVIDER_PROFILE = $(shell out=$$($(TF) output -raw provider_profile 2>/dev/null); echo "$${out:-provider}")

.DEFAULT_GOAL := help

.PHONY: help init plan apply destroy outputs \
        network services orders payments target-groups \
        orders-health payments-health weights shift-canary ram-share status inventory ec2-status \
        connect demo-orders demo-payments-denied demo-payments-allowed demo-canary

help: ## Show this help
	@echo "Terraform lifecycle:"
	@grep -E '^(init|plan|apply|destroy|outputs):.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Inspect the live stack (read-only aws vpc-lattice/ram calls):"
	@grep -E '^(network|services|orders|payments|target-groups|orders-health|payments-health|weights|ram-share|status|inventory|ec2-status):.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Drive real traffic / mutate the live stack:"
	@grep -E '^(connect|demo-orders|demo-payments-denied|demo-payments-allowed|demo-canary|shift-canary):.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ------------------------------------------------------------------------------
# Terraform lifecycle
# ------------------------------------------------------------------------------

init: ## terraform init
	$(TF) init

plan: ## terraform plan
	$(TF) plan

apply: ## terraform apply (real, cost-bearing AWS resources — see terraform/DEPLOYING.md#cost)
	$(TF) apply

destroy: ## terraform destroy (tears down both accounts' resources)
	$(TF) destroy

outputs: ## Print all terraform outputs
	$(TF) output

# ------------------------------------------------------------------------------
# Inspect the live stack — read-only, safe to run anytime post-apply
# ------------------------------------------------------------------------------

network: ## Describe the Service Network (auth type, associations)
	aws vpc-lattice get-service-network \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-network-identifier "$$($(TF) output -raw service_network_id)"

services: ## List services associated with the Service Network
	aws vpc-lattice list-service-network-service-associations \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-network-identifier "$$($(TF) output -raw service_network_id)"

orders: ## Describe the Orders service
	aws vpc-lattice get-service \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-identifier "$$($(TF) output -raw orders_service_arn)"

payments: ## Describe the Payments service
	aws vpc-lattice get-service \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-identifier "$$($(TF) output -raw payments_service_arn)"

target-groups: ## List all target groups in the provider account
	aws vpc-lattice list-target-groups \
	  --profile $(PROVIDER_PROFILE) --region $(REGION)

orders-health: ## Health-check status of the Orders v1 (EC2) target
	aws vpc-lattice list-targets \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --target-group-identifier "$$($(TF) output -raw orders_v1_target_group_id)"

payments-health: ## Health-check status of the Payments v1 (EC2) target
	aws vpc-lattice list-targets \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --target-group-identifier "$$($(TF) output -raw payments_v1_target_group_id)"

weights: ## Show the Orders listener's current v1/v2 canary weight split
	aws vpc-lattice get-listener \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-identifier "$$($(TF) output -raw orders_service_arn)" \
	  --listener-identifier "$$($(TF) output -raw orders_listener_id)" \
	  --query 'defaultAction.forward.targetGroups'

ram-share: ## Show the cross-account RAM resource share status
	aws ram get-resource-shares \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --resource-owner SELF --name vpc-lattice-shared-service-network

status: network services weights orders-health payments-health ## Run network+services+weights+health checks together

# Every resource gets Project=VPC-Lattice-Showcase / Ephemeral=true from each
# provider's default_tags (see providers.tf) — the tag Resource Groups Tagging
# API query below is a single cross-service call per account, so it catches
# VPCs/subnets/EC2/IAM/Lambda/VPC Lattice resources alike, not just Lattice.
inventory: ## List every tagged AWS resource in both accounts (Project=VPC-Lattice-Showcase)
	@echo "=== Consumer account ($(CONSUMER_PROFILE)) ==="
	@aws resourcegroupstaggingapi get-resources \
	  --profile $(CONSUMER_PROFILE) --region $(REGION) \
	  --tag-filters Key=Project,Values=VPC-Lattice-Showcase \
	  --query 'ResourceTagMappingList[].ResourceARN' --output table
	@echo ""
	@echo "=== Provider account ($(PROVIDER_PROFILE)) ==="
	@aws resourcegroupstaggingapi get-resources \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --tag-filters Key=Project,Values=VPC-Lattice-Showcase \
	  --query 'ResourceTagMappingList[].ResourceARN' --output table

# Queried by tag, not by `terraform output` instance IDs - those go blank the
# moment terraform destroy removes them from state, which is exactly when
# you most want to confirm nothing's still running/shutting-down. AWS keeps
# terminated instances visible in describe-instances for a while afterward,
# so "State: terminated" here (not just an empty result) is the real
# destroy-completed signal; an empty table means they've since aged out.
ec2-status: ## Show Name/InstanceId/State for every tagged EC2 instance in both accounts - works after terraform destroy too
	@echo "=== Consumer account ($(CONSUMER_PROFILE)) ==="
	@aws ec2 describe-instances \
	  --profile $(CONSUMER_PROFILE) --region $(REGION) \
	  --filters "Name=tag:Project,Values=VPC-Lattice-Showcase" \
	  --query 'Reservations[].Instances[].{Name:Tags[?Key==`Name`]|[0].Value,InstanceId:InstanceId,State:State.Name}' \
	  --output table
	@echo ""
	@echo "=== Provider account ($(PROVIDER_PROFILE)) ==="
	@aws ec2 describe-instances \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --filters "Name=tag:Project,Values=VPC-Lattice-Showcase" \
	  --query 'Reservations[].Instances[].{Name:Tags[?Key==`Name`]|[0].Value,InstanceId:InstanceId,State:State.Name}' \
	  --output table

# ------------------------------------------------------------------------------
# Drive real traffic / mutate the live stack
# ------------------------------------------------------------------------------

# Runs a script that Terraform's user_data already dropped onto the client
# instance (see terraform/templates/client_user_data.sh.tpl) via SSM RunCommand,
# then prints its output — this is what terraform/DEPLOYING.md's manual SSM
# session walks through by hand, non-interactively.
define ssm-run
	@CLIENT_ID="$$($(TF) output -raw client_instance_id)"; \
	CMD_ID=$$(aws ssm send-command \
	  --profile $(CONSUMER_PROFILE) --region $(REGION) \
	  --instance-ids "$$CLIENT_ID" \
	  --document-name AWS-RunShellScript \
	  --parameters commands="$(1)" \
	  --query 'Command.CommandId' --output text); \
	aws ssm wait command-executed \
	  --profile $(CONSUMER_PROFILE) --region $(REGION) \
	  --command-id "$$CMD_ID" --instance-id "$$CLIENT_ID" 2>/dev/null || true; \
	aws ssm get-command-invocation \
	  --profile $(CONSUMER_PROFILE) --region $(REGION) \
	  --command-id "$$CMD_ID" --instance-id "$$CLIENT_ID" \
	  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
endef

connect: ## Open an interactive SSM session on the client instance
	$(TF) output -raw connect_to_client | sh

demo-orders: ## Invoke Orders with the client's own role via SSM (expect HTTP 200)
	$(call ssm-run,/opt/lattice-demo/invoke-orders.sh)

demo-payments-denied: ## Invoke Payments with the client's own role via SSM (expect HTTP 403)
	$(call ssm-run,/opt/lattice-demo/invoke-payments-denied.sh)

demo-payments-allowed: ## Invoke Payments after assuming FinanceServiceRole via SSM (expect HTTP 200)
	$(call ssm-run,/opt/lattice-demo/invoke-payments-allowed.sh)

demo-canary: ## Sample the Orders listener N times via SSM and tally v1 vs v2 (usage: make demo-canary N=30)
	$(call ssm-run,/opt/lattice-demo/canary-sample.sh $(or $(N),20))

shift-canary: ## Retarget Orders weights live (usage: make shift-canary W1=50 W2=50) — WARNING: drifts from Terraform state until the next apply
	@test -n "$(W1)" && test -n "$(W2)" || { echo "Usage: make shift-canary W1=<v1 weight> W2=<v2 weight>"; exit 1; }
	@echo "WARNING: this mutates the live listener directly; terraform plan will show drift until lattice_services.tf's weights are updated to match, or you re-apply to reset them."
	aws vpc-lattice update-listener \
	  --profile $(PROVIDER_PROFILE) --region $(REGION) \
	  --service-identifier "$$($(TF) output -raw orders_service_arn)" \
	  --listener-identifier "$$($(TF) output -raw orders_listener_id)" \
	  --default-action '{"forward":{"targetGroups":[{"targetGroupIdentifier":"'"$$($(TF) output -raw orders_v1_target_group_id)"'","weight":$(W1)},{"targetGroupIdentifier":"'"$$($(TF) output -raw orders_v2_target_group_id)"'","weight":$(W2)}]}}'
