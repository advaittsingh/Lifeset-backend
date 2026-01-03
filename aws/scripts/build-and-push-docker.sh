#!/bin/bash

# LifeSet Backend Docker Build and Push Script
# This script builds the Docker image and pushes it to AWS ECR

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
REPOSITORY_NAME="${PROJECT_NAME}-${ENVIRONMENT}-backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}"

echo -e "${GREEN}Building and pushing LifeSet Backend Docker image...${NC}"
echo "Repository: $REPOSITORY_NAME"
echo "Region: $REGION"
echo "Image Tag: $IMAGE_TAG"
echo "ECR URI: $ECR_REPOSITORY_URI"
echo ""

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../" && pwd)"

cd "$BACKEND_DIR"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Login to ECR
echo -e "${YELLOW}Logging in to Amazon ECR...${NC}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REPOSITORY_URI"

# Check if repository exists, create if not
if ! aws ecr describe-repositories --repository-names "$REPOSITORY_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}Repository does not exist, creating...${NC}"
    aws ecr create-repository \
        --repository-name "$REPOSITORY_NAME" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true
fi

# Build Docker image for linux/amd64 platform (required for ECS Fargate)
echo -e "${YELLOW}Building Docker image for linux/amd64...${NC}"
docker build --platform linux/amd64 -t "$REPOSITORY_NAME:$IMAGE_TAG" .

# Tag image for ECR
echo -e "${YELLOW}Tagging image for ECR...${NC}"
docker tag "$REPOSITORY_NAME:$IMAGE_TAG" "$ECR_REPOSITORY_URI:$IMAGE_TAG"

# Push image to ECR
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker push "$ECR_REPOSITORY_URI:$IMAGE_TAG"

echo ""
echo -e "${GREEN}Docker image pushed successfully!${NC}"
echo "Image URI: $ECR_REPOSITORY_URI:$IMAGE_TAG"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Update ECS task definition with this image URI"
echo "2. Update ECS service to use the new task definition"

