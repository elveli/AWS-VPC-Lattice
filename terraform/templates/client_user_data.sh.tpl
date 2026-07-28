#!/bin/bash
set -eux

mkdir -p /opt/lattice-demo

cat > /opt/lattice-demo/aws-config <<'CONFIG'
[profile finance]
role_arn = ${finance_role_arn}
credential_source = Ec2InstanceMetadata
region = ${region}
CONFIG

cat > /opt/lattice-demo/invoke-orders.sh <<'SCRIPT'
#!/bin/bash
# Calls Orders directly with this instance's own role.
# Orders' auth policy allows the whole consumer account -> expect HTTP 200.
set -euo pipefail
eval "$(aws configure export-credentials --format env)"
curl -sS -o /dev/stdout -w '\nHTTP %%{http_code}\n' \
  --aws-sigv4 "aws:amz:${region}:vpc-lattice-svcs" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  --header "x-amz-security-token: $AWS_SESSION_TOKEN" \
  --header "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
  "https://${orders_domain}/"
SCRIPT

cat > /opt/lattice-demo/invoke-payments-denied.sh <<'SCRIPT'
#!/bin/bash
# Calls Payments directly with this instance's own role (NOT FinanceServiceRole).
# Payments' auth policy only allows the FinanceServiceRole principal -> expect HTTP 403.
set -euo pipefail
eval "$(aws configure export-credentials --format env)"
curl -sS -o /dev/stdout -w '\nHTTP %%{http_code}\n' \
  --aws-sigv4 "aws:amz:${region}:vpc-lattice-svcs" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  --header "x-amz-security-token: $AWS_SESSION_TOKEN" \
  --header "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
  "https://${payments_domain}/"
SCRIPT

cat > /opt/lattice-demo/invoke-payments-allowed.sh <<'SCRIPT'
#!/bin/bash
# Assumes FinanceServiceRole first (see /opt/lattice-demo/aws-config), then
# calls Payments -> expect HTTP 200.
set -euo pipefail
export AWS_CONFIG_FILE=/opt/lattice-demo/aws-config
eval "$(aws configure export-credentials --profile finance --format env)"
curl -sS -o /dev/stdout -w '\nHTTP %%{http_code}\n' \
  --aws-sigv4 "aws:amz:${region}:vpc-lattice-svcs" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  --header "x-amz-security-token: $AWS_SESSION_TOKEN" \
  --header "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
  "https://${payments_domain}/"
SCRIPT

cat > /opt/lattice-demo/canary-sample.sh <<'SCRIPT'
#!/bin/bash
# Hits the Orders listener N times (default 20) and tallies which backend
# answered, to observe the 90/10 weighted split between the EC2 (v1) and
# Lambda (v2) targets. Usage: ./canary-sample.sh [count]
set -euo pipefail
eval "$(aws configure export-credentials --format env)"
COUNT=$${1:-20}
v1=0
v2=0
for i in $(seq 1 "$COUNT"); do
  body=$(curl -sS \
    --aws-sigv4 "aws:amz:${region}:vpc-lattice-svcs" \
    --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
    --header "x-amz-security-token: $AWS_SESSION_TOKEN" \
    --header "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
    "https://${orders_domain}/")
  case "$body" in
    *v2*) v2=$((v2 + 1)) ;;
    *) v1=$((v1 + 1)) ;;
  esac
done
echo "v1 (EC2): $v1   v2 (Lambda): $v2   (expected roughly 90/10)"
SCRIPT

chmod +x /opt/lattice-demo/*.sh
chmod 644 /opt/lattice-demo/aws-config
