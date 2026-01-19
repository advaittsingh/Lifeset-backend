#!/bin/bash

# LifeSet EC2 Application Deployment Script
# This script deploys the backend application to an EC2 instance

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

echo -e "${GREEN}Deploying Application to EC2...${NC}"
echo ""

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

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
    echo -e "${RED}Error: Could not get EC2 instance public IP${NC}"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo ""

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

# Get secrets from AWS Secrets Manager
echo -e "${YELLOW}Fetching secrets from AWS Secrets Manager...${NC}"

SECRET_NAME="lifeset/${ENVIRONMENT}/secrets"
SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query ARN \
    --output text 2>/dev/null || echo "")

if [ -z "$SECRET_ARN" ]; then
    echo -e "${RED}Error: Secrets not found. Please create secrets first:${NC}"
    echo "./create-secrets.sh"
    exit 1
fi

# Get secret values
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query SecretString \
    --output text)

# Extract values (simplified - in production, use jq)
DATABASE_URL=$(echo "$SECRET_JSON" | grep -o '"DATABASE_URL": "[^"]*' | cut -d'"' -f4)
REDIS_URL=$(echo "$SECRET_JSON" | grep -o '"REDIS_URL": "[^"]*' | cut -d'"' -f4)
JWT_SECRET=$(echo "$SECRET_JSON" | grep -o '"JWT_SECRET": "[^"]*' | cut -d'"' -f4)
JWT_REFRESH_SECRET=$(echo "$SECRET_JSON" | grep -o '"JWT_REFRESH_SECRET": "[^"]*' | cut -d'"' -f4)

# Wait for instance to be ready
echo -e "${YELLOW}Waiting for instance to be ready...${NC}"
aws ec2 wait instance-status-ok --instance-ids "$INSTANCE_ID" --region "$REGION"

# Test SSH connection
echo -e "${YELLOW}Testing SSH connection...${NC}"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10"

if ! ssh $SSH_OPTS -i "$SSH_KEY_PATH" ec2-user@"$PUBLIC_IP" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${YELLOW}Waiting a bit more for SSH to be ready...${NC}"
    sleep 30
    
    if ! ssh $SSH_OPTS -i "$SSH_KEY_PATH" ec2-user@"$PUBLIC_IP" "echo 'SSH connection successful'" 2>/dev/null; then
        echo -e "${RED}Error: Could not connect to EC2 instance via SSH${NC}"
        echo "Please check:"
        echo "1. Security group allows SSH (port 22) from your IP"
        echo "2. Instance is running"
        echo "3. SSH key is correct"
        exit 1
    fi
fi

echo -e "${GREEN}SSH connection successful${NC}"
echo ""

# Determine deployment method
DEPLOY_METHOD="${DEPLOY_METHOD:-local}"

if [ "$DEPLOY_METHOD" == "local" ]; then
    # Create a tarball of the current directory
    echo -e "${YELLOW}Creating deployment package from local files...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
    
    cd "$PROJECT_ROOT"
    
    # Create tarball excluding node_modules, dist, .git
    tar --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.git' \
        --exclude='.env' \
        --exclude='*.log' \
        -czf /tmp/lifeset-backend-deploy.tar.gz \
        -C "$(dirname "$PROJECT_ROOT")" \
        "$(basename "$PROJECT_ROOT")"
    
    # Copy tarball to EC2
    echo -e "${YELLOW}Uploading deployment package...${NC}"
    scp $SSH_OPTS -i "$SSH_KEY_PATH" /tmp/lifeset-backend-deploy.tar.gz ec2-user@"$PUBLIC_IP":/tmp/
    
    # Create deployment script
    DEPLOY_SCRIPT=$(cat <<DEPLOY_EOF
#!/bin/bash
set -e

cd /opt/lifeset-backend

# Extract deployment package
echo "Extracting deployment package..."
tar -xzf /tmp/lifeset-backend-deploy.tar.gz --strip-components=1

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build application
echo "Building application..."
npm run build

# Create .env file from secrets
echo "Creating .env file..."
cat > .env <<ENV_EOF
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
AWS_REGION=ap-south-1
ENV_EOF

# Set SSL certificate paths if they exist
if [ -f "/opt/lifeset-backend/ssl/cert.pem" ] && [ -f "/opt/lifeset-backend/ssl/key.pem" ]; then
    echo "SSL_CERT_PATH=/opt/lifeset-backend/ssl/cert.pem" >> .env
    echo "SSL_KEY_PATH=/opt/lifeset-backend/ssl/key.pem" >> .env
fi

# Restart application with PM2
echo "Restarting application..."
pm2 delete lifeset-backend 2>/dev/null || true
pm2 start dist/main.js --name lifeset-backend --log /var/log/lifeset-backend/app.log
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user 2>/dev/null || true

echo "Deployment complete!"
DEPLOY_EOF
)
else
    # Git-based deployment
    DEPLOY_SCRIPT=$(cat <<'DEPLOY_EOF'
#!/bin/bash
set -e

cd /opt/lifeset-backend

# Clone or update repository
if [ -d ".git" ]; then
    echo "Updating repository..."
    git pull
else
    echo "Cloning repository..."
    git clone ${GIT_REPO_URL} .
fi

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build application
echo "Building application..."
npm run build

# Create .env file from secrets
echo "Creating .env file..."
cat > .env <<ENV_EOF
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
AWS_REGION=ap-south-1
ENV_EOF

# Set SSL certificate paths if they exist
if [ -f "/opt/lifeset-backend/ssl/cert.pem" ] && [ -f "/opt/lifeset-backend/ssl/key.pem" ]; then
    echo "SSL_CERT_PATH=/opt/lifeset-backend/ssl/cert.pem" >> .env
    echo "SSL_KEY_PATH=/opt/lifeset-backend/ssl/key.pem" >> .env
fi

# Restart application with PM2
echo "Restarting application..."
pm2 delete lifeset-backend 2>/dev/null || true
pm2 start dist/main.js --name lifeset-backend --log /var/log/lifeset-backend/app.log
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user 2>/dev/null || true

echo "Deployment complete!"
DEPLOY_EOF
)
fi

# Copy deployment script to instance
echo -e "${YELLOW}Copying deployment script to instance...${NC}"
echo "$DEPLOY_SCRIPT" | ssh $SSH_OPTS -i "$SSH_KEY_PATH" ec2-user@"$PUBLIC_IP" "cat > /tmp/deploy.sh && chmod +x /tmp/deploy.sh"

# Execute deployment
echo -e "${YELLOW}Executing deployment...${NC}"
ssh $SSH_OPTS -i "$SSH_KEY_PATH" ec2-user@"$PUBLIC_IP" \
    "DATABASE_URL='$DATABASE_URL' \
     REDIS_URL='$REDIS_URL' \
     JWT_SECRET='$JWT_SECRET' \
     JWT_REFRESH_SECRET='$JWT_REFRESH_SECRET' \
     bash /tmp/deploy.sh"

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Application URL: http://$PUBLIC_IP:3000/api/v1"
echo "API Documentation: http://$PUBLIC_IP:3000/api/v1/docs"
echo ""
echo -e "${YELLOW}To check application status:${NC}"
echo "ssh -i $SSH_KEY_PATH ec2-user@$PUBLIC_IP 'pm2 status'"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "ssh -i $SSH_KEY_PATH ec2-user@$PUBLIC_IP 'pm2 logs lifeset-backend'"
echo ""
