# LifeSet AWS Deployment

Complete AWS deployment setup for the LifeSet platform including backend API, admin panel, and mobile server connection.

## Quick Start

### Prerequisites

1. **AWS CLI** installed and configured:
   ```bash
   aws configure
   ```

2. **Docker** installed and running

3. **Node.js 20.x** installed

### One-Command Deployment (Backend)

```bash
cd lifeset-backend/aws/scripts
export DB_PASSWORD="your_secure_password"
./quick-deploy.sh
```

This will:
1. Deploy infrastructure (VPC, RDS, ElastiCache, ECS, ALB)
2. Create secrets in AWS Secrets Manager
3. Build and push Docker image to ECR
4. Deploy ECS service

### Manual Step-by-Step Deployment

#### 1. Deploy Infrastructure

```bash
cd lifeset-backend/aws/scripts
export DB_PASSWORD="your_secure_password"
./deploy-infrastructure.sh
```

#### 2. Create Secrets

```bash
./create-secrets.sh
```

#### 3. Build and Push Docker Image

```bash
./build-and-push-docker.sh
```

#### 4. (Optional) Add SSL Certificates for HTTPS

```bash
# Set certificate file paths
export SSL_CERT_FILE="/path/to/your/cert.pem"
export SSL_KEY_FILE="/path/to/your/key.pem"

# Add certificates to AWS Secrets Manager
./add-ssl-certificates.sh
```

Or provide paths interactively:
```bash
./add-ssl-certificates.sh
```

#### 5. Deploy ECS Service

```bash
./deploy-ecs-service.sh
```

**Note**: If SSL certificates are configured, the backend will automatically use HTTPS. Otherwise, it will use HTTP.

#### 6. Deploy Admin Panel

```bash
cd ../../lifeset-admin-web/aws/scripts

# Get backend URL
BACKEND_URL=$(aws cloudformation describe-stacks \
    --stack-name lifeset-infrastructure \
    --region ap-south-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

# Deploy admin panel
BACKEND_API_URL="http://${BACKEND_URL}/api/v1" \
CLOUDFRONT_DISTRIBUTION_ID="<YOUR_DIST_ID>" \
./deploy-admin-panel.sh
```

## File Structure

```
aws/
├── infrastructure/
│   ├── cloudformation.yaml      # Main infrastructure stack
│   ├── ecs-task-definition.json  # ECS task definition template
│   └── ecs-service.json         # ECS service configuration
├── scripts/
│   ├── quick-deploy.sh          # One-command deployment
│   ├── deploy-infrastructure.sh # Deploy CloudFormation stack
│   ├── create-secrets.sh        # Create AWS Secrets Manager secrets
│   ├── add-ssl-certificates.sh  # Add SSL certificates to Secrets Manager
│   ├── build-and-push-docker.sh # Build and push Docker image
│   ├── deploy-ecs-service.sh    # Deploy ECS service
│   └── prepare-task-definition.sh # Helper script for task definition
├── DEPLOYMENT_GUIDE.md          # Detailed deployment guide
└── README.md                    # This file
```

## Configuration

### Environment Variables

The backend uses AWS Secrets Manager for sensitive data:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret

### Region

Default region: `ap-south-1` (Mumbai)

To change, update the `REGION` variable in the scripts.

## Accessing Your Deployment

After deployment, you'll get:

- **Backend API**: `http://<ALB_DNS>/api/v1` (or `https://` if SSL is configured)
- **API Docs**: `http://<ALB_DNS>/api/v1/docs` (or `https://` if SSL is configured)
- **Health Check**: `http://<ALB_DNS>/api/v1/health` (or `https://` if SSL is configured)

**Note**: If SSL certificates are configured, the backend will use HTTPS. Make sure your ALB is also configured with an HTTPS listener if you want end-to-end encryption.

## Mobile App Configuration

Update your mobile app's API base URL to:
```
http://<ALB_DNS>/api/v1
```

For production, set up a custom domain and SSL certificate.

## Troubleshooting

### Check ECS Service Status

```bash
aws ecs describe-services \
    --cluster lifeset-production-cluster \
    --services lifeset-backend-service \
    --region ap-south-1
```

### View Logs

```bash
aws logs tail /ecs/lifeset-production --follow --region ap-south-1
```

### Check ALB Health

```bash
# Get target group ARN from CloudFormation outputs
aws elbv2 describe-target-health \
    --target-group-arn <TARGET_GROUP_ARN> \
    --region ap-south-1
```

## Updating Deployment

### Update Backend

```bash
cd lifeset-backend/aws/scripts
IMAGE_TAG=v1.0.1 ./build-and-push-docker.sh
IMAGE_TAG=v1.0.1 ./deploy-ecs-service.sh
```

### Update Admin Panel

```bash
cd lifeset-admin-web/aws/scripts
BACKEND_API_URL="http://<ALB_DNS>/api/v1" \
CLOUDFRONT_DISTRIBUTION_ID="<DIST_ID>" \
./deploy-admin-panel.sh
```

## Cost Estimate

Approximate monthly costs:
- RDS (db.t3.medium): ~$50-70
- ElastiCache (cache.t3.micro): ~$15-20
- ECS Fargate (2 tasks): ~$60-80
- ALB: ~$20-25
- CloudFront: ~$5-10
- S3: ~$1-5
- **Total**: ~$150-215/month

*Costs vary by region and usage patterns.*

## SSL/HTTPS Configuration

The backend supports HTTPS when SSL certificates are provided. To enable HTTPS:

1. **Obtain SSL Certificates**:
   - Use Let's Encrypt (free) for production
   - Or use certificates from a commercial CA
   - Or generate self-signed certificates for testing

2. **Add Certificates to AWS Secrets Manager**:
   ```bash
   export SSL_CERT_FILE="/path/to/cert.pem"
   export SSL_KEY_FILE="/path/to/key.pem"
   ./add-ssl-certificates.sh
   ```

3. **Redeploy the Service**:
   ```bash
   ./deploy-ecs-service.sh
   ```

The backend will automatically detect and use the SSL certificates. Certificates are stored securely in AWS Secrets Manager and written to files in the container at startup.

**Important**: If you're using an ALB, you may want to configure SSL termination at the ALB level instead of (or in addition to) backend HTTPS. See the ALB configuration in `cloudformation.yaml`.

## Security Notes

1. Never commit secrets to version control
2. Use AWS Secrets Manager for all sensitive data
3. Enable encryption at rest for RDS and ElastiCache
4. Use HTTPS for all external traffic (configure SSL certificates)
5. Regularly rotate passwords and secrets
6. Store SSL certificates securely in AWS Secrets Manager

## Support

For detailed information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

