#!/bin/bash

# Add HTTPS Listener to ALB
# This script adds an HTTPS listener to the Application Load Balancer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REGION="ap-south-1"
STACK_NAME="lifeset-infrastructure"

echo -e "${GREEN}Adding HTTPS listener to ALB...${NC}"

# Get ALB ARN
ALB_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

if [ -z "$ALB_ARN" ]; then
    ALB_ARN=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --query 'LoadBalancers[?contains(DNSName, `lifeset-production-alb`)].LoadBalancerArn' \
        --output text)
fi

if [ -z "$ALB_ARN" ]; then
    echo -e "${RED}Error: Could not find ALB${NC}"
    exit 1
fi

echo "ALB ARN: $ALB_ARN"

# Get target group ARN
TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBTargetGroupArn`].OutputValue' \
    --output text)

if [ -z "$TARGET_GROUP_ARN" ]; then
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
        --region "$REGION" \
        --load-balancer-arn "$ALB_ARN" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
fi

echo "Target Group ARN: $TARGET_GROUP_ARN"

# Check for existing HTTPS listener
EXISTING_HTTPS=$(aws elbv2 describe-listeners \
    --load-balancer-arn "$ALB_ARN" \
    --region "$REGION" \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)

if [ -n "$EXISTING_HTTPS" ]; then
    echo -e "${YELLOW}HTTPS listener already exists${NC}"
    exit 0
fi

# Request SSL certificate (self-signed for testing, or use ACM for production)
echo -e "${YELLOW}Note: For production, you should use AWS Certificate Manager (ACM)${NC}"
echo -e "${YELLOW}For now, we'll create a self-signed certificate for testing${NC}"

read -p "Do you have an ACM certificate ARN? (y/n): " HAS_CERT
if [ "$HAS_CERT" = "y" ]; then
    read -p "Enter ACM Certificate ARN: " CERT_ARN
else
    echo -e "${YELLOW}Creating HTTPS listener without certificate (will fail, but structure is ready)${NC}"
    echo -e "${YELLOW}You need to:${NC}"
    echo "1. Request certificate in ACM (us-east-1 for CloudFront, ap-south-1 for ALB)"
    echo "2. Update this script with the certificate ARN"
    CERT_ARN=""
fi

# Create HTTPS listener
if [ -n "$CERT_ARN" ]; then
    echo -e "${YELLOW}Creating HTTPS listener...${NC}"
    aws elbv2 create-listener \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTPS \
        --port 443 \
        --certificates CertificateArn="$CERT_ARN" \
        --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" \
        --region "$REGION"
    
    echo -e "${GREEN}HTTPS listener created!${NC}"
    echo "Update mobile app to use: https://lifeset-production-alb-1834668951.ap-south-1.elb.amazonaws.com/api/v1"
else
    echo -e "${YELLOW}HTTPS listener not created. Please set up ACM certificate first.${NC}"
fi
