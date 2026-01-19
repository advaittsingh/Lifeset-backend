#!/bin/bash

# Update CloudFront Origin Response Timeout Script
# This script updates CloudFront to increase timeout for API requests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REGION="ap-south-1"
CLOUDFRONT_ID="E3B2N2LVRXNG4J"

echo -e "${GREEN}Updating CloudFront distribution timeout settings...${NC}"

# Get current config and ETag
echo -e "${YELLOW}Fetching current CloudFront configuration...${NC}"
CONFIG_FILE="/tmp/cloudfront-config-$(date +%s).json"
ETAG=$(aws cloudfront get-distribution-config \
    --id "$CLOUDFRONT_ID" \
    --query 'ETag' \
    --output text)

aws cloudfront get-distribution-config \
    --id "$CLOUDFRONT_ID" \
    --query 'DistributionConfig' \
    --output json > "$CONFIG_FILE"

if [ ! -f "$CONFIG_FILE" ] || [ ! -s "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Failed to get CloudFront configuration${NC}"
    exit 1
fi

echo -e "${YELLOW}Updating /api/* cache behavior settings...${NC}"

# Use Python to update the config
python3 << PYEOF
import json
import sys

config_file = "$CONFIG_FILE"
etag = "$ETAG"
cloudfront_id = "$CLOUDFRONT_ID"

try:
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    # Update the /api/* cache behavior
    updated = False
    for behavior in config['CacheBehaviors']['Items']:
        if behavior['PathPattern'] == '/api/*':
            # Set to not cache POST requests
            behavior['AllowedMethods'] = {
                'Quantity': 7,
                'Items': ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
                'CachedMethods': {
                    'Quantity': 2,
                    'Items': ['GET', 'HEAD']
                }
            }
            
            # Use cache policy that disables caching (for POST requests)
            behavior['CachePolicyId'] = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'  # Managed-CachingDisabled
            
            # Remove ForwardedValues if present (deprecated)
            if 'ForwardedValues' in behavior:
                del behavior['ForwardedValues']
            if 'MinTTL' in behavior:
                del behavior['MinTTL']
            if 'DefaultTTL' in behavior:
                del behavior['DefaultTTL']
            if 'MaxTTL' in behavior:
                del behavior['MaxTTL']
            
            updated = True
            break
    
    if not updated:
        print("Warning: /api/* cache behavior not found")
    
    # Update backend origin connection settings
    for origin in config['Origins']['Items']:
        if origin['Id'] == 'BackendAPIOrigin':
            # Ensure CustomOriginConfig exists with proper timeouts
            if 'CustomOriginConfig' not in origin:
                origin['CustomOriginConfig'] = {}
            
            # Set origin read timeout to 60 seconds (max allowed by CloudFront)
            origin['CustomOriginConfig']['OriginReadTimeout'] = 60
            origin['CustomOriginConfig']['OriginKeepaliveTimeout'] = 5
            origin['CustomOriginConfig']['HTTPPort'] = 80
            origin['CustomOriginConfig']['HTTPSPort'] = 443
            origin['CustomOriginConfig']['OriginProtocolPolicy'] = 'http-only'
            break
    
    # Save updated config
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("✅ Configuration updated successfully")
    
except Exception as e:
    print(f"❌ Error updating config: {e}")
    sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to update configuration${NC}"
    exit 1
fi

# Update CloudFront distribution
echo -e "${YELLOW}Updating CloudFront distribution...${NC}"
UPDATE_RESULT=$(aws cloudfront update-distribution \
    --id "$CLOUDFRONT_ID" \
    --if-match "$ETAG" \
    --distribution-config "file://$CONFIG_FILE" \
    --query 'Distribution.{Id:Id,Status:Status,DomainName:DomainName}' \
    --output json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CloudFront distribution update initiated successfully!${NC}"
    echo "$UPDATE_RESULT" | python3 -m json.tool
    
    echo ""
    echo -e "${YELLOW}Note: CloudFront distribution updates can take 15-20 minutes to deploy${NC}"
    echo -e "${YELLOW}The changes will be live once the distribution status changes to 'Deployed'${NC}"
    echo ""
    echo -e "${GREEN}Changes made:${NC}"
    echo "  - Origin Read Timeout: 60 seconds (max allowed)"
    echo "  - POST requests: Not cached"
    echo "  - API requests: Will have longer timeout"
else
    echo -e "${RED}❌ Failed to update CloudFront distribution${NC}"
    echo "$UPDATE_RESULT"
    exit 1
fi

# Cleanup
rm -f "$CONFIG_FILE"

echo ""
echo -e "${GREEN}Done!${NC}"
