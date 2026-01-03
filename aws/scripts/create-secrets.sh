#!/bin/bash

# LifeSet AWS Secrets Manager Setup Script
# This script creates secrets in AWS Secrets Manager for the LifeSet platform

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

# Prompt for secrets
echo -e "${YELLOW}Please provide the following secrets:${NC}"

read -sp "Database Password: " DB_PASSWORD
echo ""

read -sp "JWT Secret: " JWT_SECRET
echo ""

read -sp "JWT Refresh Secret: " JWT_REFRESH_SECRET
echo ""

read -p "Database Username (default: lifeset_admin): " DB_USERNAME
DB_USERNAME=${DB_USERNAME:-lifeset_admin}

read -p "Database Name (default: lifeset): " DB_NAME
DB_NAME=${DB_NAME:-lifeset}

echo ""
echo -e "${YELLOW}AWS S3 Configuration (for file uploads):${NC}"
read -p "AWS Access Key ID (leave empty to skip S3 setup): " AWS_ACCESS_KEY_ID
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    read -sp "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo ""
    read -p "S3 Bucket Name (e.g., lifeset-uploads): " S3_BUCKET_NAME
else
    AWS_SECRET_ACCESS_KEY=""
    S3_BUCKET_NAME=""
fi

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}?schema=public"

# Construct REDIS_URL (assuming no password for now, adjust if needed)
REDIS_URL="redis://${REDIS_ENDPOINT}:${REDIS_PORT}"

# Create JSON secret
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$S3_BUCKET_NAME" ]; then
    SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "$DATABASE_URL",
  "REDIS_URL": "$REDIS_URL",
  "JWT_SECRET": "$JWT_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "AWS_ACCESS_KEY_ID": "$AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY": "$AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET_NAME": "$S3_BUCKET_NAME"
}
EOF
)
else
    SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "$DATABASE_URL",
  "REDIS_URL": "$REDIS_URL",
  "JWT_SECRET": "$JWT_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET"
}
EOF
)
fi

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
echo -e "${YELLOW}Note: Make sure to update the ECS task definition with the secret ARN${NC}"

