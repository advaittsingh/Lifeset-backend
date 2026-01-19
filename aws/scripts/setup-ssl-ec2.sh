#!/bin/bash

# LifeSet EC2 SSL Certificate Setup Script
# This script sets up SSL certificates on the EC2 instance

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
STACK_NAME="${PROJECT_NAME}-ec2-${ENVIRONMENT}"

echo -e "${GREEN}Setting up SSL Certificates on EC2...${NC}"
echo ""

# Get certificate files
CERT_FILE="${SSL_CERT_FILE:-}"
KEY_FILE="${SSL_KEY_FILE:-}"

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo -e "${YELLOW}SSL certificate files not provided via environment variables.${NC}"
    read -p "SSL Certificate file path (e.g., /path/to/cert.pem): " CERT_FILE
    read -p "SSL Private Key file path (e.g., /path/to/key.pem): " KEY_FILE
fi

if [ ! -f "$CERT_FILE" ]; then
    echo -e "${RED}Error: Certificate file not found: $CERT_FILE${NC}"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}Error: Private key file not found: $KEY_FILE${NC}"
    exit 1
fi

# Get EC2 instance details
echo -e "${YELLOW}Fetching EC2 instance details...${NC}"

INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`EC2InstanceId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}Error: EC2 instance not found. Please deploy EC2 infrastructure first:${NC}"
    echo "./deploy-ec2-infrastructure.sh"
    exit 1
fi

PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

# Get SSH key
if [ -z "$EC2_KEY_PAIR" ]; then
    read -p "Enter path to SSH private key (e.g., ~/.ssh/my-key.pem): " SSH_KEY_PATH
else
    SSH_KEY_PATH="$EC2_KEY_PAIR"
fi

if [ ! -f "$SSH_KEY_PATH" ]; then
    echo -e "${RED}Error: SSH key file not found: $SSH_KEY_PATH${NC}"
    exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo ""

# Copy certificates to instance
echo -e "${YELLOW}Copying certificates to EC2 instance...${NC}"

scp $SSH_OPTS -i "$SSH_KEY_PATH" "$CERT_FILE" ec2-user@"$PUBLIC_IP":/tmp/cert.pem
scp $SSH_OPTS -i "$SSH_KEY_PATH" "$KEY_FILE" ec2-user@"$PUBLIC_IP":/tmp/key.pem

# Move certificates to secure location and update application
echo -e "${YELLOW}Setting up certificates on instance...${NC}"

ssh $SSH_OPTS -i "$SSH_KEY_PATH" ec2-user@"$PUBLIC_IP" <<'SSH_EOF'
# Move certificates to secure location
sudo mkdir -p /opt/lifeset-backend/ssl
sudo mv /tmp/cert.pem /opt/lifeset-backend/ssl/cert.pem
sudo mv /tmp/key.pem /opt/lifeset-backend/ssl/key.pem
sudo chmod 644 /opt/lifeset-backend/ssl/cert.pem
sudo chmod 600 /opt/lifeset-backend/ssl/key.pem
sudo chown ec2-user:ec2-user /opt/lifeset-backend/ssl/*

# Update .env file
cd /opt/lifeset-backend
if [ -f .env ]; then
    # Remove old SSL paths if they exist
    sed -i '/SSL_CERT_PATH/d' .env
    sed -i '/SSL_KEY_PATH/d' .env
fi

# Add SSL paths
echo "SSL_CERT_PATH=/opt/lifeset-backend/ssl/cert.pem" >> .env
echo "SSL_KEY_PATH=/opt/lifeset-backend/ssl/key.pem" >> .env

# Restart application
pm2 restart lifeset-backend || pm2 start dist/main.js --name lifeset-backend --log /var/log/lifeset-backend/app.log

echo "SSL certificates configured successfully!"
SSH_EOF

echo ""
echo -e "${GREEN}SSL certificates set up successfully!${NC}"
echo ""
echo "Application should now be running on HTTPS"
echo "URL: https://$PUBLIC_IP:3000/api/v1"
echo ""
echo -e "${YELLOW}To verify:${NC}"
echo "ssh -i $SSH_KEY_PATH ec2-user@$PUBLIC_IP 'pm2 logs lifeset-backend | grep -i ssl'"
echo ""
