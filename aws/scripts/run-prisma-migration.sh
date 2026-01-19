#!/bin/bash

# Run Prisma Migration on ECS Task
# This script executes Prisma migrations on a running ECS task

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
CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-cluster"
SERVICE_NAME="${PROJECT_NAME}-backend-service"

echo -e "${GREEN}Running Prisma Migration on ECS Task...${NC}"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Get running task ARN
TASK_ARN=$(aws ecs list-tasks \
    --cluster "$CLUSTER_NAME" \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --desired-status RUNNING \
    --query 'taskArns[0]' \
    --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
    echo -e "${RED}Error: No running task found for service $SERVICE_NAME${NC}"
    exit 1
fi

echo -e "${YELLOW}Found task: ${TASK_ARN}${NC}"
echo ""

# Run Prisma migration
echo -e "${YELLOW}Running Prisma migration...${NC}"
aws ecs execute-command \
    --cluster "$CLUSTER_NAME" \
    --task "$TASK_ARN" \
    --container lifeset-backend \
    --region "$REGION" \
    --interactive \
    --command "npx prisma migrate deploy"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed!${NC}"
    exit 1
fi
