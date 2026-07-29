# Deploying this Terraform for real

This directory is genuinely `terraform apply`-able against two real AWS accounts. It's meant to be spun up for a learning session and destroyed afterward, not left running — see [Cost](#cost) and [Destroy](#destroy) below.

## Prerequisites

- Terraform >= 1.3
- AWS CLI v2
- Two AWS accounts, each with an IAM identity that can create VPCs, EC2 instances, IAM roles, Lambda functions, and VPC Lattice resources
- Two local AWS CLI profiles, one per account:
  ```
  aws configure --profile consumer
  aws configure --profile provider
  ```

## Setup

1. Copy the tfvars template and fill in your real account IDs and profile names:
   ```
   cp terraform.tfvars.example terraform.tfvars
   ```
   `terraform.tfvars` is gitignored — your real account IDs never get committed. The variable *defaults* in `variables.tf` stay as the placeholder IDs (`111111111111` / `222222222222`) so the illustrative version keeps working for anyone just reading the code.

2. Initialize and review the plan:
   ```
   terraform init
   terraform plan
   ```
   State is kept locally (no remote backend) — this is a solo, short-lived stack, so a local `terraform.tfstate` is simpler and this file is also gitignored.

3. Apply:
   ```
   terraform apply
   ```
   Or `make apply` — see [Makefile shortcuts](#makefile-shortcuts) below, which wraps this same lifecycle plus the read/demo commands further down this doc.

## Cost

Verified against AWS's current pricing pages (July 2026), region `us-east-1`:

| Resource | Rate | Qty | Approx /hr |
|---|---|---|---|
| VPC Lattice service | $0.025/hr each | 2 (orders, payments) | $0.050 |
| EC2 `t3.micro` | $0.0104/hr each | 3 (client, order target, payment target) | $0.031 |
| Lambda | free tier covers this volume | 1 | ~$0.000 |
| VPC Lattice data processed | $0.025/GB | negligible for manual testing | ~$0.000 |
| Internet Gateway | free (no NAT Gateway used) | 3 | $0.000 |

**Total: roughly $0.08–0.10/hour.** A several-hour learning session should land well under $1. Every resource is tagged `Ephemeral = "true"` and `Project = "VPC-Lattice-Showcase"` so it's easy to filter in Cost Explorer or the console if you want to double-check — or run `make inventory` (see the [README's Makefile Reference](../README.md#makefile-reference)) to list every tagged resource in both accounts from the command line. Pricing can change or vary by region — see the [VPC Lattice pricing page](https://aws.amazon.com/vpc/lattice/pricing/) and [EC2 pricing page](https://aws.amazon.com/ec2/pricing/on-demand/) for current numbers.

## Try it out

After `apply` finishes, connect to the client instance via SSM (no SSH keys needed):

```
terraform output -raw connect_to_client   # prints the ready-to-run command
```

Once connected, the helper scripts in `/opt/lattice-demo/` are ready to go:

- `./invoke-orders.sh` — calls Orders directly with the instance's own role. Orders' auth policy allows the whole consumer account → **expect HTTP 200**.
- `./invoke-payments-denied.sh` — calls Payments directly with the same role. Payments' auth policy only allows the `FinanceServiceRole` principal → **expect HTTP 403**.
- `./invoke-payments-allowed.sh` — assumes `FinanceServiceRole` first, then calls Payments → **expect HTTP 200**.
- `./canary-sample.sh 30` — hits the Orders listener 30 times and tallies which backend answered, to observe the 90/10 weighted split between the EC2 (v1) and Lambda (v2) targets live.

You can also `curl` the `/v2` path directly (via any of the scripts' pattern) to see the listener rule override that sends `/v2/*` to the Lambda target 100% of the time, regardless of the weighted default.

If a script fails with `curl: option --aws-sigv4: not supported`, the AMI's `curl-minimal` build is missing it — run `sudo dnf swap curl-minimal curl -y` and retry.

## Makefile shortcuts

Everything above (plus read-only inspection commands like checking canary weights or target health) is also available via the `Makefile` at the repo root, so you don't have to keep pasting ARNs/IDs by hand — every target is a real `terraform`/`aws vpc-lattice`/`aws ram`/`aws ssm` call, resolved live via `terraform output`. Run `make help` from the repo root, or see the full target-by-target reference in the [README's Makefile Reference](../README.md#makefile-reference).

## Destroy

```
terraform destroy
```

Afterward, it's worth a quick sanity check in the AWS console or Cost Explorer (filter by the `Ephemeral = true` tag) in both accounts to confirm nothing lingering remains — Terraform will have removed the VPCs, EC2 instances, Lambda function, IAM roles, and all VPC Lattice resources it created.
