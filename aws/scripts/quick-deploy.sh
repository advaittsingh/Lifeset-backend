#!/bin/bash

# LifeSet Quick Deployment Script
# This script automates the entire deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LifeSet AWS Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
REGION="ap-south-1"
ENVIRONMENT="production"
PROJECT_NAME="lifeset"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured. Run 'aws configure'${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Get database password
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}Database password not set in environment${NC}"
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
    export DB_PASSWORD
fi

# Step 1: Deploy Infrastructure
echo -e "${BLUE}Step 1: Deploying Infrastructure...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "deploy-infrastructure.sh" ]; then
    echo -e "${RED}Error: deploy-infrastructure.sh not found${NC}"
    exit 1
fi

chmod +x deploy-infrastructure.sh
./deploy-infrastructure.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}Infrastructure deployment failed${NC}"
    exit 1
fi

echo ""

# Step 2: Create Secrets
echo -e "${BLUE}Step 2: Creating Secrets...${NC}"
chmod +x create-secrets.sh
./create-secrets.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}Secrets creation failed${NC}"
    exit 1
fi

echo ""

# Step 3: Build and Push Docker Image
echo -e "${BLUE}Step 3: Building and Pushing Docker Image...${NC}"
chmod +x build-and-push-docker.sh
./build-and-push-docker.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}Docker build/push failed${NC}"
    exit 1
fi

echo ""

# Step 4: Deploy ECS Service
echo -e "${BLUE}Step 4: Deploying ECS Service...${NC}"
chmod +x deploy-ecs-service.sh
./deploy-ecs-service.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}ECS service deployment failed${NC}"
    exit 1
fi

echo ""

# Get ALB DNS name
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name lifeset-infrastructure \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backend Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backend API URL: http://$ALB_DNS/api/v1"
echo "API Documentation: http://$ALB_DNS/api/v1/docs"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy admin panel:"
echo "   cd ../../lifeset-admin-web/aws/scripts"
echo "   BACKEND_API_URL=\"http://$ALB_DNS/api/v1\" ./deploy-admin-panel.sh"
echo ""
echo "2. Update mobile app configuration with backend URL"
echo ""
echo -e "${YELLOW}Note: It may take a few minutes for the service to be fully available${NC}"

