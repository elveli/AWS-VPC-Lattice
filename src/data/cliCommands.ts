import { CliCommand } from "../types";

export const cliCommands: CliCommand[] = [
  {
    command: "aws vpc-lattice list-service-networks --region us-east-1",
    description: "Lists all VPC Lattice service networks in your AWS account.",
    category: "discovery",
    args: { region: "us-east-1" },
    output: {
      items: [
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-01a2b3c4f5e6g7",
          createdAt: "2026-06-21T12:00:00Z",
          id: "sn-01a2b3c4f5e6g7",
          name: "corporate-prod-service-network",
          numberOfAssociatedServices: 2,
          numberOfAssociatedVpcs: 3
        }
      ]
    }
  },
  {
    command: "aws vpc-lattice list-services --region us-east-1",
    description: "Returns summaries of all VPC Lattice services under the active AWS profile.",
    category: "discovery",
    args: { region: "us-east-1" },
    output: {
      items: [
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-orders123abc",
          createdAt: "2026-06-21T12:15:00Z",
          customDomainName: "orders.corp.internal",
          dnsEntry: {
            domainName: "orders-service-0a1b2c3d4e5f.vpc-lattice.us-east-1.on.aws",
            hostedZoneId: "Z01234567LATTICE"
          },
          id: "svc-orders123abc",
          name: "orders-service",
          status: "ACTIVE"
        },
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-payments987xyz",
          createdAt: "2026-06-21T12:20:00Z",
          customDomainName: "payments.corp.internal",
          dnsEntry: {
            domainName: "payments-service-9f8e7d6c5b4a.vpc-lattice.us-east-1.on.aws",
            hostedZoneId: "Z01234567LATTICE"
          },
          id: "svc-payments987xyz",
          name: "payments-service",
          status: "ACTIVE"
        }
      ]
    }
  },
  {
    command: "aws vpc-lattice get-auth-policy --resource-identifier arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-01a2b3c4f5e6g7",
    description: "Describes the active zero-trust security policy attached at the Service Network entry gate.",
    category: "iam",
    args: { "resource-identifier": "arn:aws:...:servicenetwork/sn-01a2" },
    output: {
      policy: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Sid\": \"AllowCrossAccountAuthenticatedAccess\",\n      \"Effect\": \"Allow\",\n      \"Principal\": {\n        \"AWS\": \"arn:aws:iam::111111111111:root\"\n      },\n      \"Action\": \"vpc-lattice-svcs:Invoke\",\n      \"Resource\": \"*\",\n      \"Condition\": {\n        \"StringEquals\": {\n          \"vpc-lattice-svcs:SourceVpc\": \"vpc-01a2b3c4d5e6f7g8h\"\n        }\n      }\n    }\n  ]\n}",
      lastUpdatedAt: "2026-06-21T12:05:00Z"
    }
  },
  {
    command: "aws vpc-lattice list-target-groups --region us-east-1",
    description: "Lists all standard backend cluster routing target targets.",
    category: "routing",
    args: { region: "us-east-1" },
    output: {
      items: [
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-orders-v1-fargate",
          id: "tg-0123abc456",
          name: "orders-v1-tg",
          port: 80,
          protocol: "HTTP",
          status: "ACTIVE",
          type: "IP",
          vpcIdentifier: "vpc-077b9666c0dd"
        },
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-orders-v2-lambda",
          id: "tg-789xyz456",
          name: "orders-v2-lambda-tg",
          status: "ACTIVE",
          type: "LAMBDA"
        }
      ]
    }
  },
  {
    command: "aws ram accept-resource-share-invitation --resource-share-invitation-arn arn:aws:ram:us-east-1:222222222222:resource-share-invitation/inv-0a1b2c3d",
    description: "Accepts shared resource networks across AWS accounts.",
    category: "lifecycle",
    args: { "resource-share-invitation-arn": "arn:aws:ram:...:inv-0a1b2c3d" },
    output: {
      resourceShareInvitation: {
        resourceShareInvitationArn: "arn:aws:ram:us-east-1:222222222222:resource-share-invitation/inv-0a1b2c3d",
        resourceShareName: "vpc-lattice-shared-service-network",
        resourceShareArn: "arn:aws:ram:us-east-1:222222222222:resource-share/rs-55a2c3",
        senderAccountId: "222222222222",
        receiverAccountId: "111111111111",
        status: "ACCEPTED"
      }
    }
  },
  {
    command: "aws vpc-lattice list-listeners --service-identifier svc-orders123abc --region us-east-1",
    description: "Returns listener specifications associated with your target microservice.",
    category: "routing",
    args: { "service-identifier": "svc-orders123abc" },
    output: {
      items: [
        {
          arn: "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-orders123abc/listener/lst-888999",
          createdAt: "2026-06-21T12:16:00Z",
          id: "lst-888999",
          name: "orders-listener",
          port: 80,
          protocol: "HTTP",
          defaultAction: {
            forward: {
              targetGroups: [
                {
                  targetGroupIdentifier: "tg-0123abc456",
                  weight: 90
                },
                {
                  targetGroupIdentifier: "tg-789xyz456",
                  weight: 10
                }
              ]
            }
          }
        }
      ]
    }
  }
];
