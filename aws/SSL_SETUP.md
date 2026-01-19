# SSL/HTTPS Setup Guide

This guide explains how to set up HTTPS for the LifeSet backend on AWS.

## Overview

The backend now supports HTTPS when SSL certificates are provided. Certificates are stored securely in AWS Secrets Manager and automatically loaded by the ECS container at startup.

## Prerequisites

1. SSL Certificate file (`.pem` or `.crt`)
2. SSL Private Key file (`.pem` or `.key`)
3. AWS CLI configured with appropriate permissions
4. Access to AWS Secrets Manager

## Step 1: Obtain SSL Certificates

### Option A: Use Let's Encrypt (Recommended for Production)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate for your domain
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem (certificate)
# /etc/letsencrypt/live/yourdomain.com/privkey.pem (private key)
```

### Option B: Use AWS Certificate Manager (ACM)

If you're using an Application Load Balancer, you can use ACM certificates for SSL termination at the ALB level. This is often simpler than backend-level HTTPS.

### Option C: Generate Self-Signed Certificate (Testing Only)

```bash
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -subj "/CN=yourdomain.com"
```

**Warning**: Self-signed certificates will show security warnings in browsers and should only be used for testing.

## Step 2: Add Certificates to AWS Secrets Manager

### Using the Provided Script

```bash
cd aws/scripts

# Set certificate file paths
export SSL_CERT_FILE="/path/to/cert.pem"
export SSL_KEY_FILE="/path/to/key.pem"

# Add certificates to Secrets Manager
./add-ssl-certificates.sh
```

### Manual Method

If you prefer to add certificates manually:

```bash
# Read certificate content
CERT_CONTENT=$(cat /path/to/cert.pem)
KEY_CONTENT=$(cat /path/to/key.pem)

# Create certificate secret
aws secretsmanager create-secret \
  --name "lifeset/production/ssl-cert" \
  --description "LifeSet Production SSL Certificate" \
  --secret-string "$CERT_CONTENT" \
  --region ap-south-1

# Create private key secret
aws secretsmanager create-secret \
  --name "lifeset/production/ssl-key" \
  --description "LifeSet Production SSL Private Key" \
  --secret-string "$KEY_CONTENT" \
  --region ap-south-1
```

## Step 3: Deploy the Backend

The deployment script will automatically detect and use SSL certificates if they exist in Secrets Manager:

```bash
cd aws/scripts
./deploy-ecs-service.sh
```

The script will:
1. Check for SSL certificates in Secrets Manager
2. Include them in the ECS task definition if found
3. Deploy the service with HTTPS enabled

## Step 4: Verify HTTPS is Working

After deployment, check the logs to confirm HTTPS is enabled:

```bash
aws logs tail /ecs/lifeset-production --follow --region ap-south-1
```

Look for messages like:
```
SSL certificates loaded from: /tmp/ssl/cert.pem and /tmp/ssl/key.pem
Application is running on: https://localhost:3000
SSL enabled with certificates from: ...
```

## How It Works

1. **Certificate Storage**: SSL certificates are stored in AWS Secrets Manager as separate secrets:
   - `lifeset/production/ssl-cert` - Certificate content
   - `lifeset/production/ssl-key` - Private key content

2. **Container Startup**: When the container starts, `docker-entrypoint.sh`:
   - Reads certificate content from environment variables (populated from Secrets Manager)
   - Writes them to `/tmp/ssl/cert.pem` and `/tmp/ssl/key.pem`
   - Sets `SSL_CERT_PATH` and `SSL_KEY_PATH` environment variables

3. **Backend Startup**: The NestJS application:
   - Checks for `SSL_CERT_PATH` and `SSL_KEY_PATH` environment variables
   - Loads certificates if found
   - Creates an HTTPS server instead of HTTP

## Updating Certificates

To update certificates:

```bash
# Update certificate files
export SSL_CERT_FILE="/path/to/new-cert.pem"
export SSL_KEY_FILE="/path/to/new-key.pem"

# Update secrets
./add-ssl-certificates.sh

# Redeploy service
./deploy-ecs-service.sh
```

## Troubleshooting

### Certificates Not Loading

1. **Check Secrets Manager**:
   ```bash
   aws secretsmanager describe-secret \
     --secret-id "lifeset/production/ssl-cert" \
     --region ap-south-1
   ```

2. **Check ECS Task Definition**:
   ```bash
   aws ecs describe-task-definition \
     --task-definition lifeset-backend \
     --region ap-south-1 \
     --query 'taskDefinition.containerDefinitions[0].secrets'
   ```

3. **Check Container Logs**:
   ```bash
   aws logs tail /ecs/lifeset-production --follow --region ap-south-1
   ```

### Backend Still Using HTTP

- Verify certificates are in Secrets Manager
- Check that the task definition includes SSL secrets
- Ensure the container has permissions to read from Secrets Manager
- Check logs for certificate loading errors

### Certificate Expired

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && \
  SSL_CERT_FILE=/etc/letsencrypt/live/yourdomain.com/fullchain.pem \
  SSL_KEY_FILE=/etc/letsencrypt/live/yourdomain.com/privkey.pem \
  /path/to/add-ssl-certificates.sh && \
  /path/to/deploy-ecs-service.sh
```

## ALB SSL Termination (Alternative Approach)

Instead of (or in addition to) backend HTTPS, you can configure SSL termination at the ALB level:

1. Request a certificate in AWS Certificate Manager (ACM)
2. Update the ALB listener in `cloudformation.yaml` to use HTTPS
3. Configure the ALB to forward to the backend on HTTP or HTTPS

This approach is often simpler and provides better performance, but backend-level HTTPS provides end-to-end encryption.

## Security Best Practices

1. **Never commit certificates to version control**
2. **Use AWS Secrets Manager** for certificate storage
3. **Rotate certificates regularly** (especially Let's Encrypt)
4. **Use strong private keys** (RSA 2048+ or ECDSA)
5. **Monitor certificate expiration** and set up alerts
6. **Use ACM for ALB** when possible for automatic renewal

## Support

For issues or questions, check:
- AWS Secrets Manager documentation
- ECS task definition logs
- Container application logs
