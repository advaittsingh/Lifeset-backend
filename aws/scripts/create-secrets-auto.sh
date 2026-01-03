#!/bin/bash

# LifeSet AWS Secrets Manager Setup Script (Non-interactive version)
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
ENVIRONMENT="production"
SECRET_NAME="lifeset/${ENVIRONMENT}/secrets"

echo -e "${GREEN}Creating secrets in AWS Secrets Manager...${NC}"
echo "Secret Name: $SECRET_NAME"
echo "Region: $REGION"
echo ""

# Get CloudFormation stack outputs
STACK_NAME="lifeset-infrastructure"
echo -e "${YELLOW}Fetching infrastructure details from CloudFormation...${NC}"

DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text)

DB_PORT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabasePort`].OutputValue' \
    --output text)

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
    --output text)

REDIS_PORT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RedisPort`].OutputValue' \
    --output text)

if [ -z "$DB_ENDPOINT" ] || [ -z "$REDIS_ENDPOINT" ]; then
    echo -e "${RED}Error: Could not retrieve infrastructure details. Make sure the CloudFormation stack is deployed.${NC}"
    exit 1
fi

echo "Database Endpoint: $DB_ENDPOINT:$DB_PORT"
echo "Redis Endpoint: $REDIS_ENDPOINT:$REDIS_PORT"
echo ""

# Get secrets from environment variables
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}"
DB_USERNAME="${DB_USERNAME:-lifeset_admin}"
DB_NAME="${DB_NAME:-lifeset}"

if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
    echo -e "${RED}Error: DB_PASSWORD, JWT_SECRET, and JWT_REFRESH_SECRET must be set as environment variables${NC}"
    exit 1
fi

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}?schema=public"

# Construct REDIS_URL
REDIS_URL="redis://${REDIS_ENDPOINT}:${REDIS_PORT}"

# Create JSON secret
SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "$DATABASE_URL",
  "REDIS_URL": "$REDIS_URL",
  "JWT_SECRET": "$JWT_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET"
}
EOF
)

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}Secret exists, updating...${NC}"
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
else
    echo -e "${YELLOW}Creating new secret...${NC}"
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "LifeSet ${ENVIRONMENT} environment secrets" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
fi

echo ""
echo -e "${GREEN}Secrets created/updated successfully!${NC}"
echo "Secret ARN: $(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" --query ARN --output text)"
echo ""
