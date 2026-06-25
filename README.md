# AWS VPC Lattice Simulator

An interactive, in-browser simulator and learning tool for **AWS VPC Lattice** — multi-account/multi-VPC service networking, SigV4 IAM authorization, and weighted canary routing. It's a static React app: there's no backend and no live AWS calls. All traffic, logs, and policy evaluation are simulated client-side so you can explore Lattice behavior without an AWS account.

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

> ⚠️ **This Terraform is illustrative, not deploy-ready.** It uses placeholder account IDs (`111111111111` / `222222222222`), has no remote backend/state configuration, and is intended to be read alongside the simulator — not applied to a real AWS account as-is. If you want to adapt it for real use, review every resource, wire up real account IDs/roles, and add a backend config first.

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

If you want to run these against a real AWS account, you'll need your own actual Lattice service network, services, and IAM credentials — none of the IDs above are real.
