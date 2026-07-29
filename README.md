# AWS VPC Lattice Simulator

An interactive learning tool for **AWS VPC Lattice** — multi-account/multi-VPC service networking, SigV4 IAM authorization, and weighted canary routing — with two genuinely different ways to explore it from this one repo.

## Contents

- [Simulator vs. real deployment](#simulator-vs-real-deployment)
- [Features](#features)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
  - [Lattice vs. PrivateLink](#lattice-vs-privatelink)
- [IAM-Based Authentication & SigV4 Signing](#iam-based-authentication--sigv4-signing)
- [AWS CLI Reference](#aws-cli-reference)
- [Makefile Reference](#makefile-reference)

## Simulator vs. real deployment

| | **Browser simulator** (this app, `src/`) | **Real AWS deployment** (`terraform/`) |
|---|---|---|
| What it is | A static React app | Actual Terraform-provisioned AWS infrastructure |
| AWS account needed? | No | Yes — two accounts + local AWS CLI profiles |
| Cost | $0 | ~$0.08–0.10/hour while it's running |
| What happens under the hood | All "traffic," logs, and IAM policy evaluation are simulated client-side from static data in `src/data/` — no backend, no live AWS calls | Real VPCs, a real VPC Lattice service network, real EC2/Lambda targets, real cross-account RAM sharing, and real SigV4-authenticated HTTP requests |
| Get started | `npm install && npm run dev` (below) | [`terraform/DEPLOYING.md`](terraform/DEPLOYING.md) |

They mirror each other conceptually — same topology, same auth policies, same canary weights — but are otherwise independent: the app never shells out to Terraform or AWS, and deploying the real stack doesn't require running the app at all. **If you just want to poke at Lattice concepts for free, use the browser simulator below. If you want a real, hands-on 2-account Lattice service network you can `curl` against, go straight to [`terraform/DEPLOYING.md`](terraform/DEPLOYING.md)** — it also has a `Makefile` (see [Makefile Reference](#makefile-reference)) for driving that real stack without hand-typing ARNs.

## Features

- **Topology Simulation** — fire simulated requests through a client → Lattice endpoint → service network → target group path, watch the animated trace, and see allow/deny decisions and weighted canary splits land in a live access-log table. Includes quick presets (authorized/unauthorized payments, v1/v2 path routing, anonymous block).
- **IAM Policy Lab** — edit the Service Network and Service auth policy JSON side by side and see how the dual-layer (defense-in-depth) authorization model changes simulated request outcomes.
- **Terraform Blueprints** — browse annotated, illustrative Terraform for a 3-VPC / 2-account Lattice setup (consumer VPC, Orders & Payments provider VPCs, RAM sharing, IP and Lambda target groups).
- **AWS CLI Playbook** — a reference of representative `aws vpc-lattice` / `aws ram` commands with sample output, for learning the CLI surface area.

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Other scripts: `npm run build` (production build), `npm run preview` (preview the build), `npm run lint` (`tsc --noEmit`).

---

## Architecture Overview

AWS VPC Lattice is an application-layer service network that connects, secures, and monitors services across different VPCs and AWS accounts, without transit gateways, PrivateLink, elaborate routing tables, or overlapping CIDR coordination. This is the topology the simulator models:

```
                  [ ACCOUNT A: CONSUMER ]
                    +------------------+
                    |   Consumer VPC   |
                    |   (10.100.0.0)   |
                    |  +------------+  |
                    |  | Client EC2 |  |
                    |  +-----+------+  |
                    +--------|---------+
                             | 
               (AWS Link-Local: 169.254.171.0/24)
                             v
   =======================================================
   [ ACCOUNT B (PROVIDER): PROD LATTICE SERVICE NETWORK ]
   =======================================================
                             |
         SigV4 IAM Auth Check & Route Matching
                             |
         +-------------------+-------------------+
         | (Weight: 90%)                         | (Weight: 10% / Path: /v2)
         v                                       v
+------------------------+              +------------------------+
|    Order VPC (Acct B)  |              |    Serverless Lambda   |
|   +----------------+   |              |   (Orders v2 Lambda)   |
|   | Orders v1 IP   |   |              |                        |
|   +----------------+   |              |                        |
+------------------------+              +------------------------+
```

The **Terraform Blueprints** tab (backed by `terraform/`) illustrates:
- **Three isolated VPCs**: one consumer/client VPC (Account A) and two backend VPCs (Account B — Orders & Payments).
- **Service Network**: a central communication domain shared securely across account boundaries with custom IAM auth policies.
- **Microservice targets**: IP targets (ECS/Fargate) and serverless targets (Lambda) behind weighted canary rules.
- **Cross-account sharing**: AWS RAM (Resource Access Manager) to link VPCs to the service network.

> ⚠️ **This Terraform is real, cost-bearing infrastructure**, not just illustrative — it's genuinely `terraform apply`-able against two AWS accounts (variable defaults are placeholder account IDs; real ones go in a gitignored `terraform.tfvars`). Running it costs roughly **$0.08–0.10/hour**. See [`terraform/DEPLOYING.md`](terraform/DEPLOYING.md) for setup, cost breakdown, a usage walkthrough, and the `terraform destroy` step — don't leave it running. Once deployed, drive it via the [Makefile Reference](#makefile-reference) below instead of hand-typing commands.

### Lattice vs. PrivateLink

| | PrivateLink | VPC Lattice |
|---|---|---|
| Layer | L4 (network/transport) | L7 (HTTP/HTTPS/gRPC) |
| Relationship | 1:1 — one endpoint per service | Many-to-many — a shared service network |
| Routing | None — a private pipe to one target | Path-based rules, weighted/canary target groups |
| Auth | Whatever the backend implements | Built-in IAM/SigV4, at both network and service level |

In short: PrivateLink gives a VPC a private route to one specific service; Lattice is a mesh where many services across many accounts share routing and IAM auth policy. They're complementary, not mutually exclusive.

---

## IAM-Based Authentication & SigV4 Signing

AWS VPC Lattice natively supports **AWS_SIGV4** as an authorization mechanism: every HTTP or gRPC request can be required to carry a Signature Version 4-signed AWS credential. The **IAM Policy Lab** tab lets you edit both policy layers and see how they interact:

1. **Service Network Auth Policy** — a broad gatekeeper policy governing access to any service within the mesh.
2. **Service Auth Policy** — a narrower policy applied to a specific microservice.

Example Service Auth Policy (as used by the simulator's "Payments" service), restricting access to a specific role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RestrictPaymentsToFinanceRoleOnly",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:role/FinanceServiceRole"
      },
      "Action": "vpc-lattice-svcs:Invoke",
      "Resource": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-payment123",
      "Condition": {
        "StringEquals": {
          "vpc-lattice-svcs:RequestMethod": "POST"
        }
      }
    }
  ]
}
```

---

## AWS CLI Reference

The **AWS CLI Playbook** tab in the app surfaces commands like these (with canned sample output) as a learning reference — they aren't executed against any real account from this repo:

```bash
# List all active Service Networks
aws vpc-lattice list-service-networks --region us-east-1

# Describe a Service Network's configuration
aws vpc-lattice get-service-network \
  --service-network-identifier arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-01a2b3c4f5

# List services associated with a Service Network
aws vpc-lattice list-service-network-service-associations \
  --service-network-identifier sn-01a2b3c4f5

# Accept a cross-account RAM resource share invitation
aws ram accept-resource-share-invitation \
  --resource-share-invitation-arn arn:aws:ram:us-east-1:222222222222:resource-share-invitation/xyz-abc

# Adjust canary weights on a listener (e.g. 50/50 blue-green)
aws vpc-lattice update-listener \
  --service-identifier svc-088c676451e0123 \
  --listener-identifier listener-02b4d5e \
  --default-action '{"forward": {"targetGroups": [{"targetGroupIdentifier": "tg-v1", "weight": 50}, {"targetGroupIdentifier": "tg-v2", "weight": 50}]}}'

# Sign a request to a Lattice service with SigV4 via curl
curl -H "Host: orders.corp.internal" \
     --aws-sigv4 "aws:amz:us-east-1:vpc-lattice-svcs" \
     --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
     http://orders-service-y01ab2c34d.vpc-lattice.us-east-1.on.aws/orders
```

None of the IDs above are real — this is a reference for learning the CLI surface area, not something to run as-is.

If you want to run the real equivalents against an actually-deployed stack, see the [Makefile Reference](#makefile-reference) below.

---

## Makefile Reference

The `Makefile` at the repo root drives the real, deployed stack — every target is a real `terraform`/`aws vpc-lattice`/`aws ram`/`aws ssm` call, with IDs/ARNs resolved live via `terraform output` instead of hand-pasted placeholders. Requires the Terraform stack from [Simulator vs. real deployment](#simulator-vs-real-deployment) to be deployed first — see [`terraform/DEPLOYING.md`](terraform/DEPLOYING.md). Run `make help` from the repo root to print this same list from the Makefile itself.

**Terraform lifecycle**

| Target | What it does |
|---|---|
| `make init` | `terraform init` |
| `make plan` | `terraform plan` |
| `make apply` | `terraform apply` — real, cost-bearing AWS resources, see [terraform/DEPLOYING.md#cost](terraform/DEPLOYING.md#cost) |
| `make destroy` | `terraform destroy` — tears down both accounts' resources |
| `make outputs` | Print all terraform outputs |

**Inspect the live stack** — read-only, safe to run anytime post-apply

| Target | What it does |
|---|---|
| `make network` | Describe the Service Network (auth type, associations) |
| `make services` | List services associated with the Service Network |
| `make orders` | Describe the Orders service |
| `make payments` | Describe the Payments service |
| `make target-groups` | List all target groups in the provider account |
| `make orders-health` | Health-check status of the Orders v1 (EC2) target |
| `make payments-health` | Health-check status of the Payments v1 (EC2) target |
| `make weights` | Show the Orders listener's current v1/v2 canary weight split |
| `make ram-share` | Show the cross-account RAM resource share status |
| `make status` | Runs `network` + `services` + `weights` + both health checks together |
| `make inventory` | List every tagged AWS resource in both accounts (`Project=VPC-Lattice-Showcase`), via the Resource Groups Tagging API — section headers show each account ID |
| `make ec2-status` | Show AccountId/Name/InstanceId/State for every tagged EC2 instance in both accounts — queried by tag, not `terraform output`, so it still works right after `terraform destroy` to confirm instances actually terminated |

**Drive real traffic / mutate the live stack**

| Target | What it does |
|---|---|
| `make connect` | Open an interactive SSM session on the client instance |
| `make demo-orders` | Invoke Orders with the client's own role via SSM — expect HTTP 200 |
| `make demo-payments-denied` | Invoke Payments with the client's own role via SSM — expect HTTP 403 |
| `make demo-payments-allowed` | Invoke Payments after assuming `FinanceServiceRole` via SSM — expect HTTP 200 |
| `make demo-canary N=30` | Sample the Orders listener N times via SSM and tally v1 vs v2 (`N` defaults to 20) |
| `make shift-canary W1=50 W2=50` | Retarget Orders weights live via `update-listener` — **warning:** drifts from Terraform state until the next apply |

`make demo-*` is the non-interactive equivalent of the manual SSM-session walkthrough in [`terraform/DEPLOYING.md`](terraform/DEPLOYING.md#try-it-out) — same scripts, run over SSM RunCommand instead of an interactive session, output printed straight to your terminal. `make shift-canary` mutates the live listener directly, outside of Terraform — useful for playing with the split live, but it'll show as drift in the next `terraform plan` until either `lattice_services.tf` is updated to match or you re-apply to reset it.

Every target reads `REGION`/`CONSUMER_PROFILE`/`PROVIDER_PROFILE` from `terraform output` (falling back to the `terraform.tfvars.example` defaults if nothing's deployed yet); override any of them per-invocation, e.g. `make network PROVIDER_PROFILE=my-other-profile`.
