# AWS VPC Lattice Production Architecture Guide

Welcome to the **AWS VPC Lattice Showcase and Interactive Simulation Portal**. This repository contains a fully structured, production-ready Multi-Account & Multi-VPC terraform infrastructure, along with absolute guidance on setting up, testing, and managing traffic using the AWS CLI and IAM-based authentication (SigV4).

---

## 🏗️ Architecture Overview

AWS VPC Lattice is an application-layer service network that connects, secures, and monitors your services across different VPCs and AWS accounts. It removes the need for transit gateways, private links, elaborate routing tables, or overlapping CIDR coordination.

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

Our Terraform workspace includes configurations for:
- **Three Isolated VPCs**: One consumer/client VPC (Account A) and two backend VPCs (Account B - Orders & Payments).
- **Service Network**: A central communication domain shared securely across boundaries with custom IAM Auth policies.
- **Microservices Deployment**: Zero-trust authenticated services backed by IP targets (ECS/Fargate) and Serverless targets (AWS Lambda) with canary weighted loops.
- **Cross-Account Sharing**: Integrated with **AWS RAM (Resource Access Manager)** to link VPC networks automatically.

All Terraform files are stored in the `/terraform` directory of this codebase.

---

## 🔒 IAM-Based Authentication & SigV4 signing

AWS VPC Lattice natively supports **AWS_SIGV4** as an authorization mechanism. When enabled, every HTTP or gRPC request must be signed with AWS credentials using the Standard Signature Version 4 protocol.

### 1. The Policy Layering
Lattice applies a **Defense-in-Depth** dual authorization model:
1. **Service Network Auth Policy**: A broad gatekeeper policy that governs who can access any service within the entire mesh.
2. **Service Auth Policy**: A narrow granular policy applied to specific microservices governing direct access rules.

### 2. Sample Service Auth Policy for High Security
Applied to the `Payments Service`, this restricts transactions solely to a specific financial role within Account A:
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
      "Resource": "arn:aws:aws:vpc-lattice:us-east-1:222222222222:service/svc-payment123",
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

## ⌨️ AWS CLI Command Reference

This playbook covers complete command sequences required to discover resources, manage configurations, and observe active logs.

### 1. Resource Discovery & Diagnostics
Client nodes can instantly resolve and audit current Service Networks or linked services.

```bash
# List all active Service Networks in the provider account
aws vpc-lattice list-service-networks --region us-east-1

# Describe the custom parameters and auth configurations
aws vpc-lattice get-service-network \
  --service-network-identifier arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-01a2b3c4f5

# List services associated with the Service Network
aws vpc-lattice list-service-network-service-associations \
  --service-network-identifier sn-01a2b3c4f5
```

### 2. Cross-Account Acceptance via AWS RAM (Consumer Side)
Once shared via Terraform/RAM from Account B, the Consumer Account A must confirm and accept:

```bash
# List resources shared with your account
aws ram get-resource-shares \
  --resource-owner OTHER-ACCOUNTS \
  --region us-east-1

# Accept the RAM resource share invitation
aws ram accept-resource-share-invitation \
  --resource-share-invitation-arn arn:aws:ram:us-east-1:222222222222:resource-share-invitation/xyz-abc
```

### 3. Traffic Management & Canary Rule Adjustments
To adjust target groups weights on the fly without changing underlying deployment code:

```bash
# List listeners attached to the Order Service
aws vpc-lattice list-listeners --service-identifier svc-088c676451e0123

# Update a listener rule on a Service to change weights (e.g., 50/50 Blue-Green Canary)
aws vpc-lattice update-listener \
  --service-identifier svc-088c676451e0123 \
  --listener-identifier listener-02b4d5e \
  --default-action '{"forward": {"targetGroups": [{"targetGroupIdentifier": "tg-v1", "weight": 50}, {"targetGroupIdentifier": "tg-v2", "weight": 50}]}}'
```

### 4. Direct Node-to-Node Curl Verification with SigV4
To trigger requests from a consumer EC2 container where SigV4 is required:

```bash
# Query the orders endpoint using AWS CLI curl with built-in request signing
curl -H "Host: orders.corp.internal" \
     --aws-sigv4 "aws:amz:us-east-1:vpc-lattice-svcs" \
     --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
     http://orders-service-y01ab2c34d.vpc-lattice.us-east-1.on.aws/orders
```

---

## 🚀 How to Deploy Using Terraform

Follow these sequential instructions to build the multi-account, securing network:

### Prerequisites:
- AWS CLI configured with credentials for both **Account A (Consumer)** and **Account B (Provider)**.
- Local Terraform installation.

### Steps:
1. Clone the project or use the source files located in `/terraform`.
2. Initialize and validate:
   ```bash
   cd terraform
   terraform init
   terraform validate
   ```
3. Run a plan to inspect the resource topology:
   ```bash
   terraform plan -out=lattice.plan
   ```
4. Deploy the infrastructure:
   ```bash
   terraform apply lattice.plan
   ```
5. Confirm resources represent correct states by reviewing output DNS routes.
