#!/bin/bash

# LifeSet ECS Service Deployment Script
# This script creates/updates the ECS task definition and service

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
TASK_FAMILY="${PROJECT_NAME}-backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-${ENVIRONMENT}-backend"

echo -e "${GREEN}Deploying ECS Service...${NC}"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Get CloudFormation stack outputs
STACK_NAME="lifeset-infrastructure"
echo -e "${YELLOW}Fetching infrastructure details from CloudFormation...${NC}"

TASK_EXECUTION_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' \
    --output text)

PRIVATE_SUBNET_1=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' \
    --output text | cut -d',' -f1)

PRIVATE_SUBNET_2=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnetIds`].OutputValue' \
    --output text | cut -d',' -f2)

ECS_SG_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' \
    --output text)

TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBTargetGroupArn`].OutputValue' \
    --output text)

SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "lifeset/${ENVIRONMENT}/secrets" \
    --region "$REGION" \
    --query ARN \
    --output text 2>/dev/null || echo "")

# Get SSL certificate secret ARNs (optional - will be empty if not set)
SSL_CERT_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "lifeset/${ENVIRONMENT}/ssl-cert" \
    --region "$REGION" \
    --query ARN \
    --output text 2>/dev/null || echo "")

SSL_KEY_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "lifeset/${ENVIRONMENT}/ssl-key" \
    --region "$REGION" \
    --query ARN \
    --output text 2>/dev/null || echo "")

if [ -z "$TASK_EXECUTION_ROLE_ARN" ] || [ -z "$PRIVATE_SUBNET_1" ]; then
    echo -e "${RED}Error: Could not retrieve infrastructure details. Make sure the CloudFormation stack is deployed.${NC}"
    exit 1
fi

# Check if SSL certificates are configured
if [ -n "$SSL_CERT_SECRET_ARN" ] && [ -n "$SSL_KEY_SECRET_ARN" ]; then
    echo -e "${GREEN}SSL certificates found in Secrets Manager${NC}"
    echo "Certificate ARN: $SSL_CERT_SECRET_ARN"
    echo "Private Key ARN: $SSL_KEY_SECRET_ARN"
else
    echo -e "${YELLOW}SSL certificates not found. HTTPS will not be enabled.${NC}"
    echo "To enable HTTPS, run: ./add-ssl-certificates.sh"
    # Use empty strings for replacement
    SSL_CERT_SECRET_ARN=""
    SSL_KEY_SECRET_ARN=""
fi

# Create task role (if it doesn't exist)
TASK_ROLE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-ecs-task-role"
if ! aws iam get-role --role-name "$TASK_ROLE_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}Creating ECS task role...${NC}"
    aws iam create-role \
        --role-name "$TASK_ROLE_NAME" \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }]
        }' \
        --region "$REGION"
    
    # Attach basic policies (add more as needed)
    aws iam attach-role-policy \
        --role-name "$TASK_ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess \
        --region "$REGION"
fi

TASK_ROLE_ARN=$(aws iam get-role --role-name "$TASK_ROLE_NAME" --query Role.Arn --output text)

# Prepare task definition
TASK_DEF_FILE="/tmp/task-definition-${TASK_FAMILY}.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get CloudFront domain for CORS (if admin panel is deployed)
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-}"
if [ -z "$CLOUDFRONT_DOMAIN" ]; then
    # Try to get from CloudFormation stack
    CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name lifeset-admin-panel \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    # If CloudFormation doesn't return the correct domain, try to get it from CloudFront directly
    if [ -z "$CLOUDFRONT_DOMAIN" ] || [ "$CLOUDFRONT_DOMAIN" == "None" ]; then
        # Get CloudFront distribution ID from stack
        CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks \
            --stack-name lifeset-admin-panel \
            --region "$REGION" \
            --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$CLOUDFRONT_DIST_ID" ] && [ "$CLOUDFRONT_DIST_ID" != "None" ]; then
            # Get domain name from CloudFront distribution
            CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
                --id "$CLOUDFRONT_DIST_ID" \
                --region "$REGION" \
                --query 'Distribution.DomainName' \
                --output text 2>/dev/null || echo "")
        fi
    fi
fi

# Set CORS origins - include CloudFront domain if available
CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:8081"
if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "None" ]; then
    # Add both possible CloudFront domains (in case there are multiple)
    CORS_ORIGINS="$CORS_ORIGINS,https://$CLOUDFRONT_DOMAIN"
    # Also add the known working domain
    CORS_ORIGINS="$CORS_ORIGINS,https://d1s4ydvkqe1aav.cloudfront.net"
    echo "Adding CloudFront domains to CORS: https://$CLOUDFRONT_DOMAIN, https://d1s4ydvkqe1aav.cloudfront.net"
fi

# Prepare task definition using Python script for proper JSON handling
echo -e "${YELLOW}Preparing task definition...${NC}"
"$SCRIPT_DIR/prepare-task-definition.sh" \
    "$SCRIPT_DIR/../infrastructure/ecs-task-definition.json" \
    "$TASK_DEF_FILE" \
    "$TASK_EXECUTION_ROLE_ARN" \
    "$TASK_ROLE_ARN" \
    "$ECR_REPOSITORY_URI:$IMAGE_TAG" \
    "$SECRET_ARN" \
    "$CORS_ORIGINS" \
    "$SSL_CERT_SECRET_ARN" \
    "$SSL_KEY_SECRET_ARN"

# Register task definition
echo -e "${YELLOW}Registering task definition...${NC}"
TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json "file://$TASK_DEF_FILE" \
    --region "$REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "Task Definition ARN: $TASK_DEF_ARN"

# Check if service exists
if aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$REGION" --query 'services[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
    echo -e "${YELLOW}Service exists, updating...${NC}"
    
    # Prepare service configuration
    SERVICE_FILE="/tmp/service-${SERVICE_NAME}.json"
    sed -e "s|REPLACE_WITH_CLUSTER_NAME|$CLUSTER_NAME|g" \
        -e "s|REPLACE_WITH_TASK_DEFINITION_ARN|$TASK_DEF_ARN|g" \
        -e "s|REPLACE_WITH_PRIVATE_SUBNET_1|$PRIVATE_SUBNET_1|g" \
        -e "s|REPLACE_WITH_PRIVATE_SUBNET_2|$PRIVATE_SUBNET_2|g" \
        -e "s|REPLACE_WITH_ECS_SECURITY_GROUP_ID|$ECS_SG_ID|g" \
        -e "s|REPLACE_WITH_TARGET_GROUP_ARN|$TARGET_GROUP_ARN|g" \
        "$SCRIPT_DIR/../infrastructure/ecs-service.json" > "$SERVICE_FILE"
    
    # Update service
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "$TASK_DEF_ARN" \
        --region "$REGION" \
        --force-new-deployment > /dev/null
    
    echo -e "${GREEN}Service update initiated. Waiting for deployment to stabilize...${NC}"
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$REGION"
else
    echo -e "${YELLOW}Service does not exist, creating...${NC}"
    
    # Prepare service configuration
    SERVICE_FILE="/tmp/service-${SERVICE_NAME}.json"
    sed -e "s|REPLACE_WITH_CLUSTER_NAME|$CLUSTER_NAME|g" \
        -e "s|REPLACE_WITH_TASK_DEFINITION_ARN|$TASK_DEF_ARN|g" \
        -e "s|REPLACE_WITH_PRIVATE_SUBNET_1|$PRIVATE_SUBNET_1|g" \
        -e "s|REPLACE_WITH_PRIVATE_SUBNET_2|$PRIVATE_SUBNET_2|g" \
        -e "s|REPLACE_WITH_ECS_SECURITY_GROUP_ID|$ECS_SG_ID|g" \
        -e "s|REPLACE_WITH_TARGET_GROUP_ARN|$TARGET_GROUP_ARN|g" \
        "$SCRIPT_DIR/../infrastructure/ecs-service.json" > "$SERVICE_FILE"
    
    # Create service
    aws ecs create-service \
        --cli-input-json "file://$SERVICE_FILE" \
        --region "$REGION" > /dev/null
    
    echo -e "${GREEN}Service created. Waiting for service to stabilize...${NC}"
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$REGION"
fi

# Get ALB DNS name
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}ECS Service deployed successfully!${NC}"
echo "Service URL: http://$ALB_DNS/api/v1"
echo "API Documentation: http://$ALB_DNS/api/v1/docs"
echo ""
echo -e "${YELLOW}Note: It may take a few minutes for the service to be fully available${NC}"

# Cleanup temp files
rm -f "$TASK_DEF_FILE" "$SERVICE_FILE"

