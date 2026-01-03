#!/bin/bash

# LifeSet IAM User Setup Script for S3 Access
# This script creates an IAM user with S3 upload permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
IAM_USER_NAME="${IAM_USER_NAME:-lifeset-s3-uploader}"
BUCKET_NAME="${S3_BUCKET_NAME:-lifeset-uploads}"

echo -e "${GREEN}Setting up IAM user for S3 access...${NC}"
echo "IAM User Name: $IAM_USER_NAME"
echo "S3 Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Check if user already exists
if aws iam get-user --user-name "$IAM_USER_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}IAM user already exists: $IAM_USER_NAME${NC}"
    read -p "Do you want to create new access keys? (y/n): " CREATE_KEYS
    if [ "$CREATE_KEYS" != "y" ]; then
        echo "Skipping access key creation."
        exit 0
    fi
else
    # Create IAM user
    echo -e "${YELLOW}Creating IAM user...${NC}"
    aws iam create-user --user-name "$IAM_USER_NAME" --region "$REGION"
    echo -e "${GREEN}IAM user created successfully!${NC}"
fi

# Create inline policy for S3 access
POLICY_NAME="S3UploadPolicy"
POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}"
    }
  ]
}
EOF
)

echo -e "${YELLOW}Attaching S3 upload policy...${NC}"

# Check if policy exists
if aws iam get-user-policy --user-name "$IAM_USER_NAME" --policy-name "$POLICY_NAME" --region "$REGION" &>/dev/null; then
    echo -e "${YELLOW}Policy exists, updating...${NC}"
    aws iam put-user-policy \
        --user-name "$IAM_USER_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --region "$REGION"
else
    echo -e "${YELLOW}Creating new policy...${NC}"
    aws iam put-user-policy \
        --user-name "$IAM_USER_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --region "$REGION"
fi

# Create access key
echo -e "${YELLOW}Creating access key...${NC}"
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$IAM_USER_NAME" --region "$REGION")

ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_KEY_ID" ] || [ -z "$SECRET_ACCESS_KEY" ]; then
    echo -e "${RED}Error: Failed to extract access key credentials${NC}"
    echo "Output: $ACCESS_KEY_OUTPUT"
    exit 1
fi

echo ""
echo -e "${GREEN}IAM user setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}IMPORTANT: Save these credentials securely!${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "AWS Access Key ID: $ACCESS_KEY_ID"
echo "AWS Secret Access Key: $SECRET_ACCESS_KEY"
echo ""
echo -e "${YELLOW}These credentials will be needed when running create-secrets.sh${NC}"
echo ""
echo -e "${GREEN}Next step: Run create-secrets.sh and provide these credentials${NC}"

# Save to a temporary file (user should delete after use)
TEMP_FILE="/tmp/lifeset-s3-credentials.txt"
cat > "$TEMP_FILE" <<EOF
AWS Access Key ID: $ACCESS_KEY_ID
AWS Secret Access Key: $SECRET_ACCESS_KEY
S3 Bucket Name: $BUCKET_NAME
EOF

echo -e "${YELLOW}Credentials saved to: $TEMP_FILE${NC}"
echo -e "${RED}WARNING: Delete this file after updating secrets!${NC}"
