#!/bin/bash

# Add HTTPS Listener to ALB using CloudFormation
# This script updates the CloudFormation stack to add an HTTPS listener

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="ap-south-1"
STACK_NAME="lifeset-infrastructure"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Add HTTPS Listener to ALB${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if certificate ARN is provided
CERT_ARN="${SSL_CERTIFICATE_ARN:-}"

if [ -z "$CERT_ARN" ]; then
    echo -e "${YELLOW}SSL Certificate ARN not provided.${NC}"
    echo ""
    echo "Options:"
    echo "1. Request a new certificate in ACM"
    echo "2. Use an existing certificate ARN"
    echo "3. List existing certificates"
    echo ""
    read -p "Choose an option (1/2/3): " OPTION
    
    case $OPTION in
        1)
            echo ""
            echo -e "${YELLOW}Requesting certificate in ACM...${NC}"
            read -p "Enter domain name (e.g., api.yourdomain.com): " DOMAIN_NAME
            
            if [ -z "$DOMAIN_NAME" ]; then
                echo -e "${RED}Error: Domain name is required${NC}"
                exit 1
            fi
            
            echo "Requesting certificate for: $DOMAIN_NAME"
            CERT_ARN=$(aws acm request-certificate \
                --domain-name "$DOMAIN_NAME" \
                --validation-method DNS \
                --region "$REGION" \
                --query 'CertificateArn' \
                --output text)
            
            if [ -z "$CERT_ARN" ]; then
                echo -e "${RED}Error: Failed to request certificate${NC}"
                exit 1
            fi
            
            echo -e "${GREEN}Certificate requested: $CERT_ARN${NC}"
            echo -e "${YELLOW}Note: You need to validate the certificate by adding DNS records${NC}"
            echo "Check ACM console for validation instructions."
            echo ""
            read -p "Continue with adding HTTPS listener? (y/n): " CONTINUE
            if [ "$CONTINUE" != "y" ]; then
                echo "Exiting. Certificate ARN: $CERT_ARN"
                exit 0
            fi
            ;;
        2)
            echo ""
            read -p "Enter ACM Certificate ARN: " CERT_ARN
            ;;
        3)
            echo ""
            echo -e "${YELLOW}Listing certificates in ACM...${NC}"
            aws acm list-certificates \
                --region "$REGION" \
                --query 'CertificateSummaryList[*].[CertificateArn,DomainName,Status]' \
                --output table
            echo ""
            read -p "Enter ACM Certificate ARN: " CERT_ARN
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac
fi

if [ -z "$CERT_ARN" ]; then
    echo -e "${RED}Error: Certificate ARN is required${NC}"
    exit 1
fi

# Validate certificate ARN format
if [[ ! "$CERT_ARN" =~ ^arn:aws:acm:.*:certificate/.*$ ]]; then
    echo -e "${RED}Error: Invalid certificate ARN format${NC}"
    echo "Expected format: arn:aws:acm:region:account:certificate/cert-id"
    exit 1
fi

# Verify certificate exists
echo -e "${YELLOW}Verifying certificate...${NC}"
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
    echo "Certificate must be ISSUED to use with ALB."
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 0
    fi
fi

echo -e "${GREEN}Certificate verified: $CERT_ARN${NC}"
echo ""

# Update CloudFormation stack
echo -e "${YELLOW}Updating CloudFormation stack to add HTTPS listener...${NC}"

# Get current stack parameters
CURRENT_PARAMS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Parameters' \
    --output json)

# Extract parameter values (excluding SSLCertificateArn)
PARAM_VALUES=$(echo "$CURRENT_PARAMS" | jq -r '.[] | select(.ParameterKey != "SSLCertificateArn") | "\(.ParameterKey)=\(.ParameterValue)"')

# Add SSL certificate ARN parameter
PARAM_VALUES="$PARAM_VALUES SSLCertificateArn=$CERT_ARN"

# Convert to CloudFormation parameter format
PARAM_ARRAY=()
while IFS= read -r param; do
    KEY=$(echo "$param" | cut -d'=' -f1)
    VALUE=$(echo "$param" | cut -d'=' -f2-)
    PARAM_ARRAY+=("ParameterKey=$KEY,ParameterValue=$VALUE")
done <<< "$PARAM_VALUES"

# Update stack
echo "Updating stack with parameters..."
aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body file://$(dirname "$0")/../infrastructure/cloudformation.yaml \
    --parameters "${PARAM_ARRAY[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" > /dev/null

if [ $? -ne 0 ]; then
    # Check if it's a "no updates" error
    ERROR=$(aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --max-items 1 \
        --query 'StackEvents[0].ResourceStatusReason' \
        --output text 2>/dev/null || echo "")
    
    if echo "$ERROR" | grep -q "No updates"; then
        echo -e "${YELLOW}No updates needed. Stack is already up to date.${NC}"
    else
        echo -e "${RED}Error updating stack${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Stack update initiated${NC}"
    echo -e "${YELLOW}Waiting for stack update to complete...${NC}"
    
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Stack update completed successfully!${NC}"
    else
        echo -e "${RED}Stack update failed${NC}"
        exit 1
    fi
fi

# Get ALB DNS name
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HTTPS Listener Added Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backend API URLs:"
echo "  HTTP:  http://${ALB_DNS}/api/v1"
echo "  HTTPS: https://${ALB_DNS}/api/v1"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update admin panel to use HTTPS URL:"
echo "   BACKEND_API_URL=\"https://${ALB_DNS}/api/v1\" ./deploy-admin-panel.sh"
echo ""
echo "2. Update mobile app configuration to use HTTPS"
echo ""
echo "3. Test HTTPS endpoint:"
echo "   curl https://${ALB_DNS}/api/v1/health"
echo ""
