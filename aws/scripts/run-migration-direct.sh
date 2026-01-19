#!/bin/bash

# Run Prisma Migration Directly on Database
# This script runs the migration SQL directly on the production database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION="ap-south-1"
ENVIRONMENT="production"
SECRET_NAME="lifeset/${ENVIRONMENT}/secrets"

echo -e "${GREEN}Running Prisma Migration Directly on Database...${NC}"
echo "Region: $REGION"
echo "Secret: $SECRET_NAME"
echo ""

# Get DATABASE_URL from AWS Secrets Manager
echo -e "${YELLOW}Fetching DATABASE_URL from Secrets Manager...${NC}"
DATABASE_URL=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "null" ]; then
    echo -e "${RED}Error: Could not retrieve DATABASE_URL from Secrets Manager${NC}"
    exit 1
fi

echo -e "${GREEN}✓ DATABASE_URL retrieved${NC}"
echo ""

# Migration SQL
MIGRATION_SQL="ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"expoPushToken\" TEXT;"

echo -e "${YELLOW}Running migration: add_expo_push_token_to_user${NC}"
echo "SQL: $MIGRATION_SQL"
echo ""

# Run migration using psql
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
psql "$DATABASE_URL" -c "$MIGRATION_SQL"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Verifying migration...${NC}"
    psql "$DATABASE_URL" -c "\d \"User\"" | grep -i "expoPushToken" && echo -e "${GREEN}✓ Column 'expoPushToken' exists${NC}" || echo -e "${YELLOW}⚠ Column check inconclusive${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed!${NC}"
    exit 1
fi
