#!/bin/bash

# Update ALB Idle Timeout Script
# This script updates the ALB idle timeout to 300 seconds (5 minutes) for file uploads

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REGION="ap-south-1"
STACK_NAME="lifeset-infrastructure"

echo -e "${GREEN}Updating ALB idle timeout to 300 seconds...${NC}"

# Get ALB ARN
ALB_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApplicationLoadBalancerArn`].OutputValue' \
    --output text)

if [ -z "$ALB_ARN" ]; then
    ALB_ARN=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --query 'LoadBalancers[?contains(LoadBalancerName, `lifeset-production`)].LoadBalancerArn' \
        --output text)
fi

if [ -z "$ALB_ARN" ]; then
    echo -e "${RED}Error: Could not find ALB${NC}"
    exit 1
fi

echo "ALB ARN: $ALB_ARN"

# Update ALB idle timeout
echo -e "${YELLOW}Setting ALB idle timeout to 300 seconds...${NC}"
aws elbv2 modify-load-balancer-attributes \
    --load-balancer-arn "$ALB_ARN" \
    --attributes Key=idle_timeout.timeout_seconds,Value=300 \
    --region "$REGION"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ALB idle timeout updated successfully to 300 seconds${NC}"
    
    # Verify the change
    echo -e "${YELLOW}Verifying timeout setting...${NC}"
    TIMEOUT=$(aws elbv2 describe-load-balancer-attributes \
        --load-balancer-arn "$ALB_ARN" \
        --region "$REGION" \
        --query 'Attributes[?Key==`idle_timeout.timeout_seconds`].Value' \
        --output text)
    
    echo -e "${GREEN}Current ALB idle timeout: ${TIMEOUT} seconds${NC}"
else
    echo -e "${RED}❌ Failed to update ALB idle timeout${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Done! File uploads should now work without timeout errors.${NC}"
