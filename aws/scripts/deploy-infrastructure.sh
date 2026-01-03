#!/bin/bash

# LifeSet AWS Infrastructure Deployment Script
# This script deploys the CloudFormation stack for the LifeSet platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="lifeset-infrastructure"
REGION="ap-south-1"
ENVIRONMENT="production"
PROJECT_NAME="lifeset"

# Database credentials (you should use AWS Secrets Manager in production)
DB_USERNAME="${DB_USERNAME:-lifeset_admin}"
DB_PASSWORD="${DB_PASSWORD}"

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}Error: DB_PASSWORD environment variable is required${NC}"
    echo "Usage: DB_PASSWORD=your_password ./deploy-infrastructure.sh"
    exit 1
fi

echo -e "${GREEN}Deploying LifeSet Infrastructure...${NC}"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}Stack exists, updating...${NC}"
    OPERATION="update-stack"
else
    echo -e "${GREEN}Stack does not exist, creating...${NC}"
    OPERATION="create-stack"
fi

# Deploy CloudFormation stack
aws cloudformation $OPERATION \
    --stack-name "$STACK_NAME" \
    --template-body file://$(dirname "$0")/../infrastructure/cloudformation.yaml \
    --parameters \
        ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
        ParameterKey=DatabaseUsername,ParameterValue="$DB_USERNAME" \
        ParameterKey=DatabasePassword,ParameterValue="$DB_PASSWORD" \
        ParameterKey=DatabaseInstanceClass,ParameterValue="db.t3.medium" \
        ParameterKey=RedisNodeType,ParameterValue="cache.t3.micro" \
        ParameterKey=ContainerCpu,ParameterValue="512" \
        ParameterKey=ContainerMemory,ParameterValue="1024" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --tags \
        Key=Project,Value=LifeSet \
        Key=Environment,Value="$ENVIRONMENT" \
        Key=ManagedBy,Value=CloudFormation

echo ""
echo -e "${GREEN}Waiting for stack operation to complete...${NC}"

if [ "$OPERATION" = "create-stack" ]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
fi

echo ""
echo -e "${GREEN}Stack deployment completed successfully!${NC}"
echo ""
echo "Getting stack outputs..."

# Get stack outputs
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output table

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Save the stack outputs (especially DatabaseEndpoint, RedisEndpoint, ALBDNSName)"
echo "2. Create secrets in AWS Secrets Manager for sensitive environment variables"
echo "3. Build and push Docker image to ECR"
echo "4. Create ECS task definition and service"
echo "5. Deploy admin panel to S3/CloudFront"

