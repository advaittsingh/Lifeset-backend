#!/bin/bash

# LifeSet EC2 Infrastructure Deployment Script
# This script creates an EC2 instance for the backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
ENVIRONMENT="production"
PROJECT_NAME="lifeset"
STACK_NAME="${PROJECT_NAME}-ec2-${ENVIRONMENT}"

echo -e "${GREEN}Deploying EC2 Infrastructure...${NC}"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Get infrastructure details from main stack
MAIN_STACK_NAME="${PROJECT_NAME}-infrastructure"
echo -e "${YELLOW}Fetching infrastructure details...${NC}"

VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name "$MAIN_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' \
    --output text 2>/dev/null || echo "")

PUBLIC_SUBNET_IDS=$(aws cloudformation describe-stacks \
    --stack-name "$MAIN_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetIds`].OutputValue' \
    --output text 2>/dev/null || echo "")

ALB_SG_ID=$(aws cloudformation describe-stacks \
    --stack-name "$MAIN_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBSecurityGroupId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$VPC_ID" ] || [ -z "$PUBLIC_SUBNET_IDS" ]; then
    echo -e "${RED}Error: Main infrastructure stack not found or incomplete.${NC}"
    echo "Please deploy the main infrastructure first: ./deploy-infrastructure.sh"
    exit 1
fi

# Get first public subnet
PUBLIC_SUBNET_ID=$(echo "$PUBLIC_SUBNET_IDS" | cut -d',' -f1)

echo "VPC ID: $VPC_ID"
echo "Subnet ID: $PUBLIC_SUBNET_ID"
echo ""

# Get EC2 Key Pair name
if [ -z "$EC2_KEY_PAIR" ]; then
    echo -e "${YELLOW}Available EC2 Key Pairs:${NC}"
    aws ec2 describe-key-pairs --region "$REGION" --query 'KeyPairs[*].KeyName' --output table
    echo ""
    read -p "Enter EC2 Key Pair name: " EC2_KEY_PAIR
fi

if [ -z "$EC2_KEY_PAIR" ]; then
    echo -e "${RED}Error: EC2 Key Pair name is required${NC}"
    exit 1
fi

# Instance type
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"

# Deploy CloudFormation stack
echo -e "${YELLOW}Deploying EC2 instance...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../infrastructure/ec2-cloudformation.yaml"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    echo "Stack exists, updating..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
            ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
            ParameterKey=InstanceType,ParameterValue="$INSTANCE_TYPE" \
            ParameterKey=KeyPairName,ParameterValue="$EC2_KEY_PAIR" \
            ParameterKey=VPCId,ParameterValue="$VPC_ID" \
            ParameterKey=SubnetId,ParameterValue="$PUBLIC_SUBNET_ID" \
            ParameterKey=SecurityGroupId,ParameterValue="" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    echo "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
else
    echo "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
            ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
            ParameterKey=InstanceType,ParameterValue="$INSTANCE_TYPE" \
            ParameterKey=KeyPairName,ParameterValue="$EC2_KEY_PAIR" \
            ParameterKey=VPCId,ParameterValue="$VPC_ID" \
            ParameterKey=SubnetId,ParameterValue="$PUBLIC_SUBNET_ID" \
            ParameterKey=SecurityGroupId,ParameterValue="" \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    echo "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
fi

# Get outputs
INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`EC2InstanceId`].OutputValue' \
    --output text)

PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`EC2InstancePublicIP`].OutputValue' \
    --output text)

PRIVATE_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`EC2InstancePrivateIP`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}EC2 Infrastructure deployed successfully!${NC}"
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "Private IP: $PRIVATE_IP"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait a few minutes for the instance to fully initialize"
echo "2. Deploy the application: ./deploy-to-ec2.sh"
echo "3. Set up SSL certificates: ./setup-ssl-ec2.sh"
echo ""
