#!/bin/bash

# LifeSet SSL Certificate Setup Script
# This script adds SSL certificates to AWS Secrets Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
ENVIRONMENT="production"
CERT_SECRET_NAME="lifeset/${ENVIRONMENT}/ssl-cert"
KEY_SECRET_NAME="lifeset/${ENVIRONMENT}/ssl-key"

echo -e "${GREEN}Adding SSL certificates to AWS Secrets Manager...${NC}"
echo "Region: $REGION"
echo ""

# Check if certificate files are provided
CERT_FILE="${SSL_CERT_FILE:-}"
KEY_FILE="${SSL_KEY_FILE:-}"

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo -e "${YELLOW}SSL certificate files not provided via environment variables.${NC}"
    echo "Please provide certificate files:"
    read -p "SSL Certificate file path (e.g., /path/to/cert.pem): " CERT_FILE
    read -p "SSL Private Key file path (e.g., /path/to/key.pem): " KEY_FILE
fi

if [ ! -f "$CERT_FILE" ]; then
    echo -e "${RED}Error: Certificate file not found: $CERT_FILE${NC}"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}Error: Private key file not found: $KEY_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Reading certificate files...${NC}"

# Read certificate and key content
CERT_CONTENT=$(cat "$CERT_FILE")
KEY_CONTENT=$(cat "$KEY_FILE")

# Create/update certificate secret
echo -e "${YELLOW}Creating/updating SSL certificate secret...${NC}"
if aws secretsmanager describe-secret --secret-id "$CERT_SECRET_NAME" --region "$REGION" &>/dev/null; then
    echo "Updating existing certificate secret..."
    aws secretsmanager update-secret \
        --secret-id "$CERT_SECRET_NAME" \
        --secret-string "$CERT_CONTENT" \
        --region "$REGION" > /dev/null
else
    echo "Creating new certificate secret..."
    aws secretsmanager create-secret \
        --name "$CERT_SECRET_NAME" \
        --description "LifeSet ${ENVIRONMENT} SSL Certificate" \
        --secret-string "$CERT_CONTENT" \
        --region "$REGION" > /dev/null
fi

# Create/update private key secret
echo -e "${YELLOW}Creating/updating SSL private key secret...${NC}"
if aws secretsmanager describe-secret --secret-id "$KEY_SECRET_NAME" --region "$REGION" &>/dev/null; then
    echo "Updating existing private key secret..."
    aws secretsmanager update-secret \
        --secret-id "$KEY_SECRET_NAME" \
        --secret-string "$KEY_CONTENT" \
        --region "$REGION" > /dev/null
else
    echo "Creating new private key secret..."
    aws secretsmanager create-secret \
        --name "$KEY_SECRET_NAME" \
        --description "LifeSet ${ENVIRONMENT} SSL Private Key" \
        --secret-string "$KEY_CONTENT" \
        --region "$REGION" > /dev/null
fi

CERT_ARN=$(aws secretsmanager describe-secret --secret-id "$CERT_SECRET_NAME" --region "$REGION" --query ARN --output text)
KEY_ARN=$(aws secretsmanager describe-secret --secret-id "$KEY_SECRET_NAME" --region "$REGION" --query ARN --output text)

echo ""
echo -e "${GREEN}SSL certificates added successfully!${NC}"
echo "Certificate Secret ARN: $CERT_ARN"
echo "Private Key Secret ARN: $KEY_ARN"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. The ECS task definition will automatically use these secrets"
echo "2. Redeploy the ECS service: ./deploy-ecs-service.sh"
echo ""
