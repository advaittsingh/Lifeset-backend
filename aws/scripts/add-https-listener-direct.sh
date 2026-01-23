#!/bin/bash

# Add HTTPS Listener to ALB directly (without CloudFormation update)
# Use this for a quick addition of HTTPS listener

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
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --region "$REGION" \
    --query 'LoadBalancers[?contains(DNSName, `lifeset-production-alb`)].LoadBalancerArn' \
    --output text)

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

# Get certificate ARN
CERT_ARN="${SSL_CERTIFICATE_ARN:-}"

if [ -z "$CERT_ARN" ]; then
    echo ""
    echo -e "${YELLOW}No certificate ARN provided.${NC}"
    echo ""
    echo "You need an ACM certificate to add HTTPS listener."
    echo ""
    echo "Option 1: Request a new certificate"
    echo "  aws acm request-certificate \\"
    echo "    --domain-name yourdomain.com \\"
    echo "    --validation-method DNS \\"
    echo "    --region ap-south-1"
    echo ""
    echo "Option 2: List existing certificates"
    echo "  aws acm list-certificates --region ap-south-1"
    echo ""
    read -p "Enter ACM Certificate ARN (or press Enter to exit): " CERT_ARN
    
    if [ -z "$CERT_ARN" ]; then
        echo "Exiting. Run this script again with SSL_CERTIFICATE_ARN environment variable."
        exit 0
    fi
fi

# Validate certificate exists
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.Status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CERT_STATUS" == "NOT_FOUND" ]; then
    echo -e "${RED}Error: Certificate not found: $CERT_ARN${NC}"
    exit 1
fi

if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo -e "${YELLOW}Warning: Certificate status is: $CERT_STATUS${NC}"
    echo "Certificate should be ISSUED to use with ALB."
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 0
    fi
fi

# Create HTTPS listener
echo -e "${YELLOW}Creating HTTPS listener...${NC}"
aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn="$CERT_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" \
    --ssl-policy ELBSecurityPolicy-TLS-1-2-2017-01 \
    --region "$REGION"

if [ $? -eq 0 ]; then
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns "$ALB_ARN" \
        --region "$REGION" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    echo ""
    echo -e "${GREEN}HTTPS listener created successfully!${NC}"
    echo ""
    echo "Backend API URLs:"
    echo "  HTTP:  http://${ALB_DNS}/api/v1"
    echo "  HTTPS: https://${ALB_DNS}/api/v1"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update admin panel to use HTTPS URL"
    echo "2. Update mobile app configuration"
    echo "3. Test: curl https://${ALB_DNS}/api/v1/health"
else
    echo -e "${RED}Failed to create HTTPS listener${NC}"
    exit 1
fi
