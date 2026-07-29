# Live Deployment: `make` Inspect-the-Stack Output

Captured output from every `make` target in the ["Inspect the live stack"](../README.md#makefile-reference)
section (see [Makefile Reference](../README.md#makefile-reference) and [`Makefile`](../Makefile)), run
against a real, ephemeral 2-account deployment on **2026-07-29** in `us-east-1`, to show what a working
stack actually looks like end-to-end rather than just describing it.

**Account IDs are redacted** to this repo's usual placeholders (`111111111111` = consumer/Account A,
`222222222222` = provider/Account B) — everything else (resource IDs, ARNs' resource portion, IPs,
DNS names) is real output from the live stack.

> **Read this alongside a caveat, not as proof everything works end-to-end.** Every target below is a
> **control-plane** call (`aws vpc-lattice get-*` / `list-*`, `aws ram get-*`) — it asks AWS's API "what
> do you think the state of this resource is," and AWS answers `ACTIVE` / `HEALTHY` because the
> control plane genuinely is healthy. None of these calls send actual traffic through the service
> network. Separately, on this same deployment, we found VPC Lattice's **data plane** wasn't answering
> connections from the consumer VPC at all (TCP SYN to the Lattice VIP accepted at the ENI per VPC Flow
> Logs, then never answered — reproduced after both an instance restart and a full VPC
> disassociate/re-associate) — an AWS-side issue outside anything Terraform here controls. So: the
> control plane below is a legitimate, accurate picture of what's provisioned; it just isn't evidence
> that `make demo-orders` et al. will get an HTTP response on top of it.

## Contents

- [`make network`](#make-network)
- [`make services`](#make-services)
- [`make orders`](#make-orders)
- [`make payments`](#make-payments)
- [`make target-groups`](#make-target-groups)
- [`make orders-health`](#make-orders-health)
- [`make payments-health`](#make-payments-health)
- [`make weights`](#make-weights)
- [`make ram-share`](#make-ram-share)
- [`make status`](#make-status)
- [`make inventory`](#make-inventory)
- [`make ec2-status`](#make-ec2-status)

### `make network`

Describe the Service Network (auth type, associations)

```
aws vpc-lattice get-service-network \
	  --profile provider --region us-east-1 \
	  --service-network-identifier "$(terraform -chdir=terraform output -raw service_network_id)"
{
    "id": "sn-094460fd850715d82",
    "name": "corporate-prod-service-network",
    "createdAt": "2026-07-29T21:47:02.906000+00:00",
    "lastUpdatedAt": "2026-07-29T21:47:02.906000+00:00",
    "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
    "authType": "AWS_IAM",
    "sharingConfig": {
        "enabled": true
    },
    "numberOfAssociatedVPCs": 3,
    "numberOfAssociatedServices": 2
}
```

### `make services`

List services associated with the Service Network

```
aws vpc-lattice list-service-network-service-associations \
	  --profile provider --region us-east-1 \
	  --service-network-identifier "$(terraform -chdir=terraform output -raw service_network_id)"
{
    "items": [
        {
            "id": "snsa-0a3d7f6e4171700f7",
            "status": "ACTIVE",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0a3d7f6e4171700f7",
            "createdBy": "222222222222",
            "createdAt": "2026-07-29T21:47:07.084000+00:00",
            "serviceId": "svc-0508d1e969d0b446c",
            "serviceName": "payments-service",
            "serviceArn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c",
            "serviceNetworkId": "sn-094460fd850715d82",
            "serviceNetworkName": "corporate-prod-service-network",
            "serviceNetworkArn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
            "dnsEntry": {
                "domainName": "payments-service-0508d1e969d0b446c.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
                "hostedZoneId": "Z0681547Z82L3THDFSCZ"
            }
        },
        {
            "id": "snsa-0e30d3a3301405d10",
            "status": "ACTIVE",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0e30d3a3301405d10",
            "createdBy": "222222222222",
            "createdAt": "2026-07-29T21:47:06.399000+00:00",
            "serviceId": "svc-07dd40eaa14c82afe",
            "serviceName": "orders-service",
            "serviceArn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe",
            "serviceNetworkId": "sn-094460fd850715d82",
            "serviceNetworkName": "corporate-prod-service-network",
            "serviceNetworkArn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
            "dnsEntry": {
                "domainName": "orders-service-07dd40eaa14c82afe.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
                "hostedZoneId": "Z0681547Z82L3THDFSCZ"
            }
        }
    ]
}
```

### `make orders`

Describe the Orders service

```
aws vpc-lattice get-service \
	  --profile provider --region us-east-1 \
	  --service-identifier "$(terraform -chdir=terraform output -raw orders_service_arn)"
{
    "id": "svc-07dd40eaa14c82afe",
    "name": "orders-service",
    "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe",
    "createdAt": "2026-07-29T21:47:03.238000+00:00",
    "lastUpdatedAt": "2026-07-29T21:47:03.238000+00:00",
    "dnsEntry": {
        "domainName": "orders-service-07dd40eaa14c82afe.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
        "hostedZoneId": "Z0681547Z82L3THDFSCZ"
    },
    "status": "ACTIVE",
    "authType": "AWS_IAM"
}
```

### `make payments`

Describe the Payments service

```
aws vpc-lattice get-service \
	  --profile provider --region us-east-1 \
	  --service-identifier "$(terraform -chdir=terraform output -raw payments_service_arn)"
{
    "id": "svc-0508d1e969d0b446c",
    "name": "payments-service",
    "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c",
    "createdAt": "2026-07-29T21:47:03.423000+00:00",
    "lastUpdatedAt": "2026-07-29T21:47:03.423000+00:00",
    "dnsEntry": {
        "domainName": "payments-service-0508d1e969d0b446c.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
        "hostedZoneId": "Z0681547Z82L3THDFSCZ"
    },
    "status": "ACTIVE",
    "authType": "AWS_IAM"
}
```

### `make target-groups`

List all target groups in the provider account

```
aws vpc-lattice list-target-groups \
	  --profile provider --region us-east-1
{
    "items": [
        {
            "id": "tg-0594385e7ae170b9c",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0594385e7ae170b9c",
            "name": "orders-v2-lambda-tg",
            "type": "LAMBDA",
            "createdAt": "2026-07-29T21:47:02.989000+00:00",
            "lastUpdatedAt": "2026-07-29T21:47:02.989000+00:00",
            "status": "ACTIVE",
            "serviceArns": [
                "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe"
            ],
            "lambdaEventStructureVersion": "V1"
        },
        {
            "id": "tg-0eb64c9b1a4c1436d",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0eb64c9b1a4c1436d",
            "name": "payments-v1-tg",
            "type": "IP",
            "createdAt": "2026-07-29T21:47:16.098000+00:00",
            "port": 80,
            "protocol": "HTTP",
            "ipAddressType": "IPV4",
            "vpcIdentifier": "vpc-0ce5ae506ab59a578",
            "lastUpdatedAt": "2026-07-29T21:47:16.098000+00:00",
            "status": "ACTIVE",
            "serviceArns": [
                "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c"
            ]
        },
        {
            "id": "tg-0f9cb5af0bb75ab50",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0f9cb5af0bb75ab50",
            "name": "orders-v1-tg",
            "type": "IP",
            "createdAt": "2026-07-29T21:47:16.106000+00:00",
            "port": 80,
            "protocol": "HTTP",
            "ipAddressType": "IPV4",
            "vpcIdentifier": "vpc-05ef97a35956d6407",
            "lastUpdatedAt": "2026-07-29T21:47:16.106000+00:00",
            "status": "ACTIVE",
            "serviceArns": [
                "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe"
            ]
        }
    ]
}
```

### `make orders-health`

Health-check status of the Orders v1 (EC2) target

```
aws vpc-lattice list-targets \
	  --profile provider --region us-east-1 \
	  --target-group-identifier "$(terraform -chdir=terraform output -raw orders_v1_target_group_id)"
{
    "items": [
        {
            "id": "10.200.0.157",
            "port": 80,
            "status": "HEALTHY"
        }
    ]
}
```

### `make payments-health`

Health-check status of the Payments v1 (EC2) target

```
aws vpc-lattice list-targets \
	  --profile provider --region us-east-1 \
	  --target-group-identifier "$(terraform -chdir=terraform output -raw payments_v1_target_group_id)"
{
    "items": [
        {
            "id": "10.250.0.228",
            "port": 80,
            "status": "HEALTHY"
        }
    ]
}
```

### `make weights`

Show the Orders listener's current v1/v2 canary weight split

```
aws vpc-lattice get-listener \
	  --profile provider --region us-east-1 \
	  --service-identifier "$(terraform -chdir=terraform output -raw orders_service_arn)" \
	  --listener-identifier "$(terraform -chdir=terraform output -raw orders_listener_id)" \
	  --query 'defaultAction.forward.targetGroups'
[
    {
        "targetGroupIdentifier": "tg-0f9cb5af0bb75ab50",
        "weight": 90
    },
    {
        "targetGroupIdentifier": "tg-0594385e7ae170b9c",
        "weight": 10
    }
]
```

### `make ram-share`

Show the cross-account RAM resource share status

```
aws ram get-resource-shares \
	  --profile provider --region us-east-1 \
	  --resource-owner SELF --name vpc-lattice-shared-service-network
{
    "resourceShares": [
        {
            "resourceShareArn": "arn:aws:ram:us-east-1:222222222222:resource-share/ce8f2276-ff77-4228-b582-54b2c5e768cf",
            "name": "vpc-lattice-shared-service-network",
            "owningAccountId": "222222222222",
            "allowExternalPrincipals": true,
            "status": "ACTIVE",
            "tags": [
                {
                    "key": "Account",
                    "value": "Provider-B"
                },
                {
                    "key": "Project",
                    "value": "VPC-Lattice-Showcase"
                },
                {
                    "key": "Environment",
                    "value": "Learning"
                },
                {
                    "key": "ManagedBy",
                    "value": "Terraform"
                },
                {
                    "key": "Ephemeral",
                    "value": "true"
                },
                {
                    "key": "Name",
                    "value": "VPC-Lattice-RAM-Share"
                }
            ],
            "creationTime": "2026-07-29T14:47:03.290000-07:00",
            "lastUpdatedTime": "2026-07-29T14:47:03.290000-07:00",
            "featureSet": "STANDARD",
            "resourceShareConfiguration": {
                "retainSharingOnAccountLeaveOrganization": false
            }
        }
    ]
}
```

### `make status`

Run network+services+weights+health checks together (composite of the five targets above)

```
aws vpc-lattice get-service-network \
	  --profile provider --region us-east-1 \
	  --service-network-identifier "$(terraform -chdir=terraform output -raw service_network_id)"
{
    "id": "sn-094460fd850715d82",
    "name": "corporate-prod-service-network",
    "createdAt": "2026-07-29T21:47:02.906000+00:00",
    "lastUpdatedAt": "2026-07-29T21:47:02.906000+00:00",
    "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
    "authType": "AWS_IAM",
    "sharingConfig": {
        "enabled": true
    },
    "numberOfAssociatedVPCs": 3,
    "numberOfAssociatedServices": 2
}
aws vpc-lattice list-service-network-service-associations \
	  --profile provider --region us-east-1 \
	  --service-network-identifier "$(terraform -chdir=terraform output -raw service_network_id)"
{
    "items": [
        {
            "id": "snsa-0a3d7f6e4171700f7",
            "status": "ACTIVE",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0a3d7f6e4171700f7",
            "createdBy": "222222222222",
            "createdAt": "2026-07-29T21:47:07.084000+00:00",
            "serviceId": "svc-0508d1e969d0b446c",
            "serviceName": "payments-service",
            "serviceArn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c",
            "serviceNetworkId": "sn-094460fd850715d82",
            "serviceNetworkName": "corporate-prod-service-network",
            "serviceNetworkArn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
            "dnsEntry": {
                "domainName": "payments-service-0508d1e969d0b446c.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
                "hostedZoneId": "Z0681547Z82L3THDFSCZ"
            }
        },
        {
            "id": "snsa-0e30d3a3301405d10",
            "status": "ACTIVE",
            "arn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0e30d3a3301405d10",
            "createdBy": "222222222222",
            "createdAt": "2026-07-29T21:47:06.399000+00:00",
            "serviceId": "svc-07dd40eaa14c82afe",
            "serviceName": "orders-service",
            "serviceArn": "arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe",
            "serviceNetworkId": "sn-094460fd850715d82",
            "serviceNetworkName": "corporate-prod-service-network",
            "serviceNetworkArn": "arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82",
            "dnsEntry": {
                "domainName": "orders-service-07dd40eaa14c82afe.7d67968.vpc-lattice-svcs.us-east-1.on.aws",
                "hostedZoneId": "Z0681547Z82L3THDFSCZ"
            }
        }
    ]
}
aws vpc-lattice get-listener \
	  --profile provider --region us-east-1 \
	  --service-identifier "$(terraform -chdir=terraform output -raw orders_service_arn)" \
	  --listener-identifier "$(terraform -chdir=terraform output -raw orders_listener_id)" \
	  --query 'defaultAction.forward.targetGroups'
[
    {
        "targetGroupIdentifier": "tg-0f9cb5af0bb75ab50",
        "weight": 90
    },
    {
        "targetGroupIdentifier": "tg-0594385e7ae170b9c",
        "weight": 10
    }
]
aws vpc-lattice list-targets \
	  --profile provider --region us-east-1 \
	  --target-group-identifier "$(terraform -chdir=terraform output -raw orders_v1_target_group_id)"
{
    "items": [
        {
            "id": "10.200.0.157",
            "port": 80,
            "status": "HEALTHY"
        }
    ]
}
aws vpc-lattice list-targets \
	  --profile provider --region us-east-1 \
	  --target-group-identifier "$(terraform -chdir=terraform output -raw payments_v1_target_group_id)"
{
    "items": [
        {
            "id": "10.250.0.228",
            "port": 80,
            "status": "HEALTHY"
        }
    ]
}
```

### `make inventory`

List every tagged AWS resource in both accounts with status where available

```
=== Consumer account (consumer, 111111111111) ===
  -                    arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0f781f6cceabe2bb5
  -                    arn:aws:ec2:us-east-1:111111111111:subnet/subnet-0a65373454139db34
  -                    arn:aws:ec2:us-east-1:111111111111:vpc/vpc-05d762cd82e5b75a4
  -                    arn:aws:vpc-lattice:us-east-1:111111111111:servicenetworkvpcassociation/snva-0c99d94a1fc15f643
  -                    arn:aws:ec2:us-east-1:111111111111:route-table/rtb-07676327fcc47625a
  -                    arn:aws:ec2:us-east-1:111111111111:internet-gateway/igw-061178377f9bc038e
  running              arn:aws:ec2:us-east-1:111111111111:instance/i-0097cf5c6df05834c
  in-use               arn:aws:ec2:us-east-1:111111111111:volume/vol-0fb68b30e98dc470e
  -                    arn:aws:ec2:us-east-1:111111111111:security-group/sg-0a57533acd27e8471
  -                    arn:aws:iam::111111111111:instance-profile/lattice-demo-client-profile

=== Provider account (provider, 222222222222) ===
  -                    arn:aws:ec2:us-east-1:222222222222:internet-gateway/igw-0b9878d068da8535d
  -                    arn:aws:ec2:us-east-1:222222222222:route-table/rtb-0b82c5077af8f349f
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkvpcassociation/snva-0995b883640c1e8e3
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c/listener/listener-076679f119670930d
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkvpcassociation/snva-04f255c98db911c25
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0594385e7ae170b9c
  in-use               arn:aws:ec2:us-east-1:222222222222:volume/vol-0586121be5331aaf6
  -                    arn:aws:ec2:us-east-1:222222222222:vpc/vpc-05ef97a35956d6407
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-0508d1e969d0b446c
  -                    arn:aws:ec2:us-east-1:222222222222:security-group/sg-044d4e80c098bcb1a
  running              arn:aws:ec2:us-east-1:222222222222:instance/i-0b1e56c21619d4247
  -                    arn:aws:ec2:us-east-1:222222222222:security-group/sg-0b436b884d11e71c9
  -                    arn:aws:ec2:us-east-1:222222222222:subnet/subnet-08ffd141d8661ccc0
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe/listener/listener-0284b8a4cff2db72c
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:service/svc-07dd40eaa14c82afe/listener/listener-0284b8a4cff2db72c/rule/rule-0e825bdd6db03b1bd
  -                    arn:aws:ec2:us-east-1:222222222222:vpc/vpc-0ce5ae506ab59a578
  -                    arn:aws:lambda:us-east-1:222222222222:function:orders-v2-handler
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0f9cb5af0bb75ab50
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:targetgroup/tg-0eb64c9b1a4c1436d
  -                    arn:aws:ec2:us-east-1:222222222222:internet-gateway/igw-0e3d86cd8505ecd51
  in-use               arn:aws:ec2:us-east-1:222222222222:volume/vol-0cef443e64015038a
  running              arn:aws:ec2:us-east-1:222222222222:instance/i-0c5a64cc9c20b9ec4
  -                    arn:aws:ec2:us-east-1:222222222222:subnet/subnet-021613d3477abc94c
  -                    arn:aws:ec2:us-east-1:222222222222:subnet/subnet-0935d4b3a554e576e
  ACTIVE               arn:aws:ram:us-east-1:222222222222:resource-share/ce8f2276-ff77-4228-b582-54b2c5e768cf
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:servicenetwork/sn-094460fd850715d82
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0e30d3a3301405d10
  -                    arn:aws:ec2:us-east-1:222222222222:route-table/rtb-0774050e9041019ca
  -                    arn:aws:ec2:us-east-1:222222222222:subnet/subnet-02bcfd9932e88e8d2
  -                    arn:aws:iam::222222222222:instance-profile/lattice-demo-app-profile
  -                    arn:aws:vpc-lattice:us-east-1:222222222222:servicenetworkserviceassociation/snsa-0a3d7f6e4171700f7
```

### `make ec2-status`

Show AccountId/Name/InstanceId/State/PrivateIp for every tagged EC2 instance in both accounts

```
=== Consumer account (consumer, 111111111111) ===
---------------------------------------
|          DescribeInstances          |
+-------------+-----------------------+
|  AccountId  |  111111111111         |
|  InstanceId |  i-0097cf5c6df05834c  |
|  Name       |  Consumer-Client      |
|  PrivateIp  |  10.100.0.170         |
|  State      |  running              |
+-------------+-----------------------+

=== Provider account (provider, 222222222222) ===
-----------------------------------------------------------------------------------
|                                DescribeInstances                                |
+--------------+-----------------------+--------------+---------------+-----------+
|   AccountId  |      InstanceId       |    Name      |   PrivateIp   |   State   |
+--------------+-----------------------+--------------+---------------+-----------+
|  222222222222|  i-0c5a64cc9c20b9ec4  |  Order-App   |  10.200.0.157 |  running  |
|  222222222222|  i-0b1e56c21619d4247  |  Payment-App |  10.250.0.228 |  running  |
+--------------+-----------------------+--------------+---------------+-----------+
```
