#!/bin/bash

# LifeSet S3 Bucket Setup Script
# This script creates an S3 bucket for file uploads and configures it properly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
BUCKET_NAME="${S3_BUCKET_NAME:-lifeset-uploads}"

echo -e "${GREEN}Setting up S3 bucket for file uploads...${NC}"
echo "Bucket Name: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Check if bucket already exists
if aws s3 ls "s3://$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
    echo -e "${YELLOW}Bucket already exists: $BUCKET_NAME${NC}"
else
    echo -e "${YELLOW}Creating S3 bucket...${NC}"
    
    # Create bucket
    if [ "$REGION" = "us-east-1" ]; then
        # us-east-1 doesn't need LocationConstraint
        aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
    else
        # For other regions, use s3api with LocationConstraint
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$REGION" \
            --create-bucket-configuration LocationConstraint="$REGION"
    fi
    
    echo -e "${GREEN}Bucket created successfully!${NC}"
fi

# Enable versioning
echo -e "${YELLOW}Enabling versioning...${NC}"
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled \
    --region "$REGION"

# Block public access settings (we'll allow public read via bucket policy)
echo -e "${YELLOW}Configuring public access settings...${NC}"
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --region "$REGION"

# Set bucket policy for public read access
echo -e "${YELLOW}Setting bucket policy for public read access...${NC}"
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF
)

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy "$BUCKET_POLICY" \
    --region "$REGION"

# Enable CORS for web uploads
echo -e "${YELLOW}Configuring CORS...${NC}"
CORS_CONFIG=$(cat <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF
)

aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration "$CORS_CONFIG" \
    --region "$REGION"

# Enable server-side encryption
echo -e "${YELLOW}Enabling server-side encryption...${NC}"
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' \
    --region "$REGION"

echo ""
echo -e "${GREEN}S3 bucket setup completed successfully!${NC}"
echo "Bucket Name: $BUCKET_NAME"
echo "Bucket ARN: arn:aws:s3:::$BUCKET_NAME"
echo ""
echo -e "${YELLOW}Next step: Run setup-iam-user.sh to create IAM user for S3 access${NC}"
