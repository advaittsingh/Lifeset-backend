# EC2 Deployment Guide

This guide explains how to deploy the LifeSet backend to an EC2 instance instead of ECS.

## Overview

EC2 deployment provides:
- Full control over the server environment
- Direct SSH access for debugging
- Easier SSL certificate management
- More flexibility for custom configurations

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **EC2 Key Pair** created in AWS
4. **SSH access** to EC2 instance
5. **Main infrastructure** deployed (VPC, RDS, ElastiCache)

## Architecture

- **EC2 Instance**: Amazon Linux 2 with Node.js 20.x
- **Process Manager**: PM2 for application management
- **SSL Certificates**: Stored directly on EC2 instance
- **Application**: Runs directly on EC2 (not containerized)

## Step-by-Step Deployment

### Step 1: Deploy Main Infrastructure (if not already done)

```bash
cd aws/scripts
export DB_PASSWORD="your_secure_password"
./deploy-infrastructure.sh
```

This creates:
- VPC with subnets
- RDS PostgreSQL database
- ElastiCache Redis
- Security groups

### Step 2: Create Secrets in AWS Secrets Manager

```bash
./create-secrets.sh
```

### Step 3: Deploy EC2 Instance

```bash
# Set your EC2 key pair name
export EC2_KEY_PAIR="your-key-pair-name"

# Deploy EC2 infrastructure
./deploy-ec2-infrastructure.sh
```

This will:
- Create EC2 instance (t3.medium by default)
- Set up IAM role with Secrets Manager access
- Configure security groups
- Install Node.js, Docker, PM2, and dependencies

**Note**: You can customize the instance type:
```bash
INSTANCE_TYPE=t3.large ./deploy-ec2-infrastructure.sh
```

### Step 4: Deploy Application to EC2

```bash
# Set SSH key path
export EC2_KEY_PAIR="~/.ssh/your-key.pem"

# Deploy application
./deploy-to-ec2.sh
```

This will:
- Upload application code to EC2
- Install dependencies
- Build the application
- Configure environment variables from Secrets Manager
- Start the application with PM2

### Step 5: (Optional) Set Up SSL Certificates

```bash
# Set certificate file paths
export SSL_CERT_FILE="/path/to/cert.pem"
export SSL_KEY_FILE="/path/to/key.pem"
export EC2_KEY_PAIR="~/.ssh/your-key.pem"

# Set up SSL
./setup-ssl-ec2.sh
```

This will:
- Copy certificates to EC2
- Configure SSL paths in .env
- Restart the application with HTTPS

## Accessing Your Deployment

After deployment:

- **Backend API**: `http://<EC2_PUBLIC_IP>:3000/api/v1`
- **API Docs**: `http://<EC2_PUBLIC_IP>:3000/api/v1/docs`
- **Health Check**: `http://<EC2_PUBLIC_IP>:3000/api/v1/health`

If SSL is configured:
- **Backend API**: `https://<EC2_PUBLIC_IP>:3000/api/v1`

## Managing the Application

### Check Application Status

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 status'
```

### View Logs

```bash
# Real-time logs
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 logs lifeset-backend'

# Last 100 lines
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 logs lifeset-backend --lines 100'
```

### Restart Application

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 restart lifeset-backend'
```

### Stop Application

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 stop lifeset-backend'
```

## Updating the Application

### Method 1: Redeploy from Local Code

```bash
export EC2_KEY_PAIR="~/.ssh/your-key.pem"
./deploy-to-ec2.sh
```

### Method 2: Manual Update via SSH

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>

# On the EC2 instance
cd /opt/lifeset-backend
git pull  # If using git
npm ci
npm run build
pm2 restart lifeset-backend
```

## SSL Certificate Management

### Adding/Updating Certificates

```bash
export SSL_CERT_FILE="/path/to/cert.pem"
export SSL_KEY_FILE="/path/to/key.pem"
export EC2_KEY_PAIR="~/.ssh/your-key.pem"
./setup-ssl-ec2.sh
```

### Using Let's Encrypt (Recommended)

1. **Install Certbot on EC2**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
sudo yum install -y certbot
```

2. **Generate Certificate**:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. **Copy Certificates**:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/lifeset-backend/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/lifeset-backend/ssl/key.pem
sudo chown ec2-user:ec2-user /opt/lifeset-backend/ssl/*
```

4. **Update .env and Restart**:
```bash
cd /opt/lifeset-backend
echo "SSL_CERT_PATH=/opt/lifeset-backend/ssl/cert.pem" >> .env
echo "SSL_KEY_PATH=/opt/lifeset-backend/ssl/key.pem" >> .env
pm2 restart lifeset-backend
```

5. **Set Up Auto-Renewal**:
```bash
sudo crontab -e
# Add: 0 0 1 * * certbot renew --quiet && sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/lifeset-backend/ssl/ && pm2 restart lifeset-backend
```

## Configuration

### Environment Variables

The application uses a `.env` file located at `/opt/lifeset-backend/.env`. It's automatically created during deployment with values from AWS Secrets Manager.

To manually update:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
cd /opt/lifeset-backend
nano .env
pm2 restart lifeset-backend
```

### Application Directory Structure

```
/opt/lifeset-backend/
├── dist/              # Built application
├── prisma/            # Prisma schema and migrations
├── ssl/               # SSL certificates
│   ├── cert.pem
│   └── key.pem
├── .env               # Environment variables
├── package.json
└── node_modules/
```

### Logs

- **Application logs**: `/var/log/lifeset-backend/app.log`
- **PM2 logs**: `~/.pm2/logs/`
- **System logs**: `/var/log/messages`

## Troubleshooting

### Application Not Starting

1. **Check PM2 status**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 status'
```

2. **Check logs**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 logs lifeset-backend --err'
```

3. **Check environment variables**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'cat /opt/lifeset-backend/.env'
```

### Database Connection Issues

1. **Verify security group** allows EC2 to connect to RDS
2. **Check DATABASE_URL** in `.env`
3. **Test connection**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
cd /opt/lifeset-backend
npx prisma db pull
```

### SSL Certificate Issues

1. **Verify certificates exist**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'ls -la /opt/lifeset-backend/ssl/'
```

2. **Check permissions**:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'ls -l /opt/lifeset-backend/ssl/'
# cert.pem should be 644, key.pem should be 600
```

3. **Check application logs** for SSL errors:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP> 'pm2 logs lifeset-backend | grep -i ssl'
```

### Port Already in Use

If port 3000 is already in use:
```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
sudo lsof -i :3000
# Kill the process or change PORT in .env
```

## Security Best Practices

1. **Use Security Groups**: Restrict SSH access to your IP only
2. **Keep System Updated**: Regularly run `sudo yum update`
3. **Use Strong Passwords**: For database and application secrets
4. **Enable SSL**: Always use HTTPS in production
5. **Regular Backups**: Backup database and application code
6. **Monitor Logs**: Set up CloudWatch or log monitoring
7. **Rotate Certificates**: Keep SSL certificates up to date

## Cost Considerations

EC2 instance costs (approximate monthly):
- **t3.micro**: ~$7-10
- **t3.small**: ~$15-20
- **t3.medium**: ~$30-40
- **t3.large**: ~$60-80

Plus:
- EBS storage: ~$0.10/GB/month
- Data transfer: Variable

## Comparison: EC2 vs ECS

### EC2 Advantages
- Full server control
- Easier debugging with SSH
- Direct file system access
- Simpler SSL certificate management
- Lower learning curve

### ECS Advantages
- Automatic scaling
- Container orchestration
- Better resource utilization
- Managed service
- Easier multi-instance deployment

Choose EC2 for simpler deployments or when you need direct server access. Choose ECS for scalable, containerized deployments.

## Support

For issues:
1. Check application logs: `pm2 logs lifeset-backend`
2. Check system logs: `/var/log/messages`
3. Verify security groups and network connectivity
4. Review AWS CloudWatch metrics
