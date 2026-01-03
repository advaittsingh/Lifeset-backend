#!/bin/bash

# LifeSet Update Secrets with S3 Credentials
# This script updates existing secrets with S3 configuration

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
BUCKET_NAME="${S3_BUCKET_NAME:-lifeset-uploads}"

echo -e "${GREEN}Updating secrets with S3 credentials...${NC}"
echo "Secret Name: $SECRET_NAME"
echo "Region: $REGION"
echo ""

# Get existing secret
if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${RED}Error: Secret does not exist. Please run create-secrets.sh first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Fetching existing secret...${NC}"
EXISTING_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query SecretString \
    --output text)

# Parse existing secret JSON
DATABASE_URL=$(echo "$EXISTING_SECRET" | grep -o '"DATABASE_URL": "[^"]*' | cut -d'"' -f4)
REDIS_URL=$(echo "$EXISTING_SECRET" | grep -o '"REDIS_URL": "[^"]*' | cut -d'"' -f4)
JWT_SECRET=$(echo "$EXISTING_SECRET" | grep -o '"JWT_SECRET": "[^"]*' | cut -d'"' -f4)
JWT_REFRESH_SECRET=$(echo "$EXISTING_SECRET" | grep -o '"JWT_REFRESH_SECRET": "[^"]*' | cut -d'"' -f4)

# Get S3 credentials from command line or environment
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo -e "${YELLOW}Please provide S3 credentials:${NC}"
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
    read -sp "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo ""
else
    echo -e "${GREEN}Using S3 credentials from environment variables${NC}"
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo -e "${RED}Error: AWS credentials are required${NC}"
    exit 1
fi

# Create updated JSON secret
UPDATED_SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "$DATABASE_URL",
  "REDIS_URL": "$REDIS_URL",
  "JWT_SECRET": "$JWT_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "AWS_ACCESS_KEY_ID": "$AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY": "$AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET_NAME": "$BUCKET_NAME"
}
EOF
)

echo -e "${YELLOW}Updating secret...${NC}"
aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$UPDATED_SECRET_JSON" \
    --region "$REGION"

echo ""
echo -e "${GREEN}Secrets updated successfully with S3 configuration!${NC}"
echo ""
echo -e "${YELLOW}Next step: Redeploy ECS service with: ./deploy-ecs-service.sh${NC}"
