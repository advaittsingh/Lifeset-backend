#!/bin/bash

# Validate ACM Certificate and Add HTTPS Listener
# This script helps validate the ACM certificate and add HTTPS listener to ALB

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="ap-south-1"
CERT_ARN="arn:aws:acm:ap-south-1:316444451028:certificate/93e0b073-3d8d-4cee-8799-86bae3926422"
DOMAIN="lifeset.co.in"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Validate Certificate & Add HTTPS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check certificate status
echo -e "${YELLOW}Checking certificate status...${NC}"
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.Status' \
    --output text)

echo "Certificate Status: $CERT_STATUS"
echo ""

if [ "$CERT_STATUS" == "ISSUED" ]; then
    echo -e "${GREEN}Certificate is already validated!${NC}"
    SKIP_VALIDATION=true
elif [ "$CERT_STATUS" == "PENDING_VALIDATION" ]; then
    echo -e "${YELLOW}Certificate is pending validation${NC}"
    SKIP_VALIDATION=false
else
    echo -e "${RED}Certificate status: $CERT_STATUS${NC}"
    exit 1
fi

# Get validation records
if [ "$SKIP_VALIDATION" == "false" ]; then
    echo ""
    echo -e "${YELLOW}Getting DNS validation records...${NC}"
    
    VALIDATION_RECORDS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
        --output json)
    
    echo ""
    echo -e "${BLUE}DNS Records to Add:${NC}"
    echo "$VALIDATION_RECORDS" | jq -r '.[] | "CNAME: \(.[1]) -> \(.[2])"'
    echo ""
    
    # Check if domain is in Route53
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
        --query "HostedZones[?contains(Name, '${DOMAIN}')].Id" \
        --output text | head -1 | cut -d'/' -f3)
    
    if [ -n "$HOSTED_ZONE_ID" ]; then
        echo -e "${GREEN}Found Route53 hosted zone: $HOSTED_ZONE_ID${NC}"
        read -p "Add DNS validation records automatically? (y/n): " ADD_RECORDS
        
        if [ "$ADD_RECORDS" == "y" ]; then
            echo -e "${YELLOW}Adding DNS validation records...${NC}"
            
            # Extract validation record
            VAL_NAME=$(echo "$VALIDATION_RECORDS" | jq -r '.[0][1]')
            VAL_VALUE=$(echo "$VALIDATION_RECORDS" | jq -r '.[0][2]')
            
            aws route53 change-resource-record-sets \
                --hosted-zone-id "$HOSTED_ZONE_ID" \
                --change-batch "{
                    \"Changes\": [{
                        \"Action\": \"UPSERT\",
                        \"ResourceRecordSet\": {
                            \"Name\": \"$VAL_NAME\",
                            \"Type\": \"CNAME\",
                            \"TTL\": 300,
                            \"ResourceRecords\": [{
                                \"Value\": \"$VAL_VALUE\"
                            }]
                        }
                    }]
                }" > /dev/null
            
            echo -e "${GREEN}DNS validation record added!${NC}"
            echo ""
            echo -e "${YELLOW}Waiting for certificate validation (this may take 5-30 minutes)...${NC}"
            echo "You can check status with:"
            echo "  aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status' --output text"
            echo ""
            read -p "Press Enter when certificate is validated (or wait here)..."
        else
            echo ""
            echo -e "${YELLOW}Please add the DNS record manually:${NC}"
            echo "  Name: $(echo "$VALIDATION_RECORDS" | jq -r '.[0][1]')"
            echo "  Value: $(echo "$VALIDATION_RECORDS" | jq -r '.[0][2]')"
            echo "  Type: CNAME"
            echo ""
            echo "After adding the record, wait for validation and run this script again."
            exit 0
        fi
    else
        echo -e "${YELLOW}Domain not found in Route53.${NC}"
        echo ""
        echo "Please add the following DNS record manually in your DNS provider:"
        echo ""
        VAL_NAME=$(echo "$VALIDATION_RECORDS" | jq -r '.[0][1]')
        VAL_VALUE=$(echo "$VALIDATION_RECORDS" | jq -r '.[0][2]')
        echo "  Name: $VAL_NAME"
        echo "  Value: $VAL_VALUE"
        echo "  Type: CNAME"
        echo "  TTL: 300"
        echo ""
        echo "After adding the record, wait for validation (5-30 minutes) and run this script again."
        exit 0
    fi
fi

# Verify certificate is issued
echo -e "${YELLOW}Verifying certificate status...${NC}"
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.Status' \
    --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo -e "${RED}Certificate is not yet issued. Status: $CERT_STATUS${NC}"
    echo "Please wait for validation to complete and run this script again."
    exit 1
fi

echo -e "${GREEN}Certificate is validated!${NC}"
echo ""

# Add HTTPS listener
echo -e "${YELLOW}Adding HTTPS listener to ALB...${NC}"
cd "$(dirname "$0")"
SSL_CERTIFICATE_ARN="$CERT_ARN" ./add-https-listener-direct.sh

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Create Route53 A record pointing api.lifeset.co.in to ALB (optional)"
echo "2. Update admin panel to use HTTPS URL"
echo "3. Update mobile app to use HTTPS URL"
