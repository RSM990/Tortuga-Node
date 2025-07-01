#!/bin/bash
set -e

# 1. Get the parameters
PARAMS=$(aws ssm get-parameters \
  --names "/tortuga/prod/SESSION_SECRET" "/tortuga/prod/MONGO_URI" "/tortuga/prod/NODE_ENV" "/tortuga/prod/PORT" "/tortuga/prod/TEST_VALUE" \
  --with-decryption \
  --query "Parameters[*].{Name:Name,Value:Value}" \
  --output json)

# 2. Parse and export
export NODE_ENV=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/NODE_ENV") | .Value')
export PORT=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/PORT") | .Value')

export SESSION_SECRET=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/SESSION_SECRET") | .Value')
export MONGO_URI=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/MONGO_URI") | .Value')

export TEST_VALUE=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/TEST_VALUE") | .Value')


# 3. (Optional) Persist for PM2 restarts
cat <<EOF > /home/ec2-user/.tortuga_env
export NODE_ENV='$NODE_ENV'
export PORT='$PORT'
export SESSION_SECRET='$SESSION_SECRET'
export MONGO_URI='$MONGO_URI'
export TEST_VALUE='$TEST_VALUE'
EOF

chown ec2-user:ec2-user /home/ec2-user/.tortuga_env
