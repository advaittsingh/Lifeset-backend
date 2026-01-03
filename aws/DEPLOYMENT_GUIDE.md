# LifeSet AWS Deployment Guide

This guide will help you deploy the LifeSet platform (backend, admin panel, and mobile server connection) to Amazon AWS.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Docker** installed and running
4. **Node.js 20.x** installed
5. **Basic knowledge** of AWS services (ECS, RDS, ElastiCache, S3, CloudFront)

## Architecture Overview

The deployment includes:

- **Backend API**: NestJS application running on ECS Fargate
- **Admin Panel**: React/Vite application served via S3 + CloudFront
- **Database**: PostgreSQL on RDS
- **Cache**: Redis on ElastiCache
- **Load Balancer**: Application Load Balancer (ALB)
- **Container Registry**: Amazon ECR

## Step-by-Step Deployment

### Step 1: Deploy Infrastructure

Deploy the core AWS infrastructure (VPC, RDS, ElastiCache, ECS, ALB):

```bash
cd lifeset-backend/aws/scripts
chmod +x *.sh

# Set database password
export DB_PASSWORD="your_secure_password_here"

# Deploy infrastructure
./deploy-infrastructure.sh
```

This will create:
- VPC with public and private subnets
- RDS PostgreSQL database
- ElastiCache Redis cluster
- ECS cluster
- Application Load Balancer
- Security groups and networking

**Note**: Save the stack outputs, especially:
- `DatabaseEndpoint`
- `RedisEndpoint`
- `ALBDNSName`
- `ECRRepositoryURI`

### Step 2: Create Secrets in AWS Secrets Manager

Store sensitive environment variables in AWS Secrets Manager:

```bash
cd lifeset-backend/aws/scripts
./create-secrets.sh
```

You'll be prompted for:
- Database password
- JWT Secret
- JWT Refresh Secret

The script will automatically construct the `DATABASE_URL` and `REDIS_URL` using the infrastructure outputs.

### Step 3: Build and Push Docker Image

Build the backend Docker image and push it to ECR:

```bash
cd lifeset-backend/aws/scripts
./build-and-push-docker.sh
```

Or with a specific tag:

```bash
IMAGE_TAG=v1.0.0 ./build-and-push-docker.sh
```

### Step 4: Deploy ECS Service

Create/update the ECS task definition and service:

```bash
cd lifeset-backend/aws/scripts
./deploy-ecs-service.sh
```

Or with a specific image tag:

```bash
IMAGE_TAG=v1.0.0 ./deploy-ecs-service.sh
```

This will:
- Register a new task definition
- Create or update the ECS service
- Connect the service to the load balancer

### Step 5: Deploy Admin Panel

#### 5.1: Create S3 and CloudFront Distribution

```bash
cd lifeset-admin-web/aws/infrastructure

# Deploy CloudFormation stack for S3 and CloudFront
aws cloudformation create-stack \
    --stack-name lifeset-admin-panel \
    --template-body file://cloudfront-s3.yaml \
    --parameters \
        ParameterKey=ProjectName,ParameterValue=lifeset \
        ParameterKey=Environment,ParameterValue=production \
    --region ap-south-1 \
    --capabilities CAPABILITY_NAMED_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete \
    --stack-name lifeset-admin-panel \
    --region ap-south-1

# Get CloudFront Distribution ID
CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks \
    --stack-name lifeset-admin-panel \
    --region ap-south-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

# Get ALB DNS name from backend infrastructure
BACKEND_URL=$(aws cloudformation describe-stacks \
    --stack-name lifeset-infrastructure \
    --region ap-south-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)
```

#### 5.2: Build and Deploy Admin Panel

```bash
cd lifeset-admin-web/aws/scripts
chmod +x deploy-admin-panel.sh

# Deploy with backend API URL
BACKEND_API_URL="http://${BACKEND_URL}/api/v1" \
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DIST_ID}" \
./deploy-admin-panel.sh
```

### Step 6: Configure Mobile App

Update your mobile app configuration to point to the backend API:

1. Get the ALB DNS name:
```bash
aws cloudformation describe-stacks \
    --stack-name lifeset-infrastructure \
    --region ap-south-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text
```

2. Update your mobile app's API configuration:
   - Set the base URL to: `http://<ALB_DNS_NAME>/api/v1`
   - For production, set up a custom domain and SSL certificate

### Step 7: Set Up Custom Domain (Optional but Recommended)

#### 7.1: Request SSL Certificate in ACM

```bash
# Request certificate in us-east-1 (required for CloudFront)
aws acm request-certificate \
    --domain-name admin.lifeset.com \
    --validation-method DNS \
    --region us-east-1

# Request certificate in ap-south-1 (for ALB)
aws acm request-certificate \
    --domain-name api.lifeset.com \
    --validation-method DNS \
    --region ap-south-1
```

#### 7.2: Update CloudFront Distribution

```bash
# Update CloudFront stack with certificate
aws cloudformation update-stack \
    --stack-name lifeset-admin-panel \
    --template-body file://cloudfront-s3.yaml \
    --parameters \
        ParameterKey=ProjectName,ParameterValue=lifeset \
        ParameterKey=Environment,ParameterValue=production \
        ParameterKey=DomainName,ParameterValue=admin.lifeset.com \
        ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID \
    --region ap-south-1
```

#### 7.3: Create Route53 Records

```bash
# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name lifeset-admin-panel \
    --region ap-south-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
    --output text)

# Create Route53 A record (alias to CloudFront)
aws route53 change-resource-record-sets \
    --hosted-zone-id YOUR_HOSTED_ZONE_ID \
    --change-batch '{
        "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "admin.lifeset.com",
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": "Z2FDTNDATAQYW2",
                    "DNSName": "'${CLOUDFRONT_DOMAIN}'",
                    "EvaluateTargetHealth": false
                }
            }
        }]
    }'
```

## Environment Variables

### Backend Environment Variables

The backend uses the following environment variables (stored in AWS Secrets Manager):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: JWT refresh token secret
- `NODE_ENV`: Set to `production`
- `PORT`: Set to `3000`
- `API_PREFIX`: Set to `/api/v1`

### Admin Panel Environment Variables

The admin panel uses:

- `VITE_API_URL`: Backend API URL (set during build)

## Monitoring and Logs

### View ECS Logs

```bash
# View logs
aws logs tail /ecs/lifeset-production --follow --region ap-south-1
```

### Check ECS Service Status

```bash
aws ecs describe-services \
    --cluster lifeset-production-cluster \
    --services lifeset-backend-service \
    --region ap-south-1
```

### Check ALB Health

```bash
# Get target group health
aws elbv2 describe-target-health \
    --target-group-arn <TARGET_GROUP_ARN> \
    --region ap-south-1
```

## Updating the Deployment

### Update Backend

1. Build and push new Docker image:
```bash
cd lifeset-backend/aws/scripts
IMAGE_TAG=v1.0.1 ./build-and-push-docker.sh
```

2. Deploy updated service:
```bash
IMAGE_TAG=v1.0.1 ./deploy-ecs-service.sh
```

### Update Admin Panel

```bash
cd lifeset-admin-web/aws/scripts
BACKEND_API_URL="http://<ALB_DNS>/api/v1" \
CLOUDFRONT_DISTRIBUTION_ID="<DIST_ID>" \
./deploy-admin-panel.sh
```

## Troubleshooting

### Backend Not Responding

1. Check ECS service status:
```bash
aws ecs describe-services \
    --cluster lifeset-production-cluster \
    --services lifeset-backend-service \
    --region ap-south-1
```

2. Check task logs:
```bash
aws logs tail /ecs/lifeset-production --follow --region ap-south-1
```

3. Check ALB target health:
```bash
aws elbv2 describe-target-health \
    --target-group-arn <TARGET_GROUP_ARN> \
    --region ap-south-1
```

### Database Connection Issues

1. Verify security group allows traffic from ECS security group
2. Check RDS endpoint is correct in secrets
3. Verify database credentials

### Redis Connection Issues

1. Verify security group allows traffic from ECS security group
2. Check Redis endpoint is correct in secrets
3. Verify Redis cluster is in the same VPC

## Cost Optimization

- Use Fargate Spot for non-critical workloads (update capacity provider strategy)
- Use smaller instance sizes for development/staging
- Enable RDS automated backups only for production
- Set up CloudWatch alarms for cost monitoring

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use AWS Secrets Manager** for all sensitive data
3. **Enable encryption** at rest for RDS and ElastiCache
4. **Use HTTPS** for all external traffic (CloudFront + ALB)
5. **Restrict security groups** to minimum required access
6. **Enable CloudTrail** for audit logging
7. **Regularly rotate** database passwords and JWT secrets

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)
2. Configure CloudWatch alarms and monitoring
3. Set up automated backups for RDS
4. Configure WAF for CloudFront
5. Set up Route53 health checks
6. Configure auto-scaling for ECS service

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review ECS service events
3. Check ALB access logs
4. Review security group rules

## Estimated Costs (Monthly)

- **RDS db.t3.medium**: ~$50-70
- **ElastiCache cache.t3.micro**: ~$15-20
- **ECS Fargate (2 tasks)**: ~$60-80
- **ALB**: ~$20-25
- **CloudFront**: ~$5-10 (depends on traffic)
- **S3**: ~$1-5
- **Data Transfer**: Variable
- **Total**: ~$150-215/month (varies by usage)

*Note: Costs are approximate and vary by region and usage patterns.*

