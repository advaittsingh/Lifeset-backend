#!/bin/bash

# Migration Script: Metadata to Columns
# This script helps you safely migrate from metadata JSONB to dedicated columns

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Metadata to Columns Migration ===${NC}\n"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Warning: DATABASE_URL not found in environment${NC}"
    echo "Please set DATABASE_URL or provide database connection details"
    read -p "Enter database name: " DB_NAME
    read -p "Enter database host (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    read -p "Enter database port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Enter database user: " DB_USER
    read -sp "Enter database password: " DB_PASS
    echo ""
    
    export PGPASSWORD=$DB_PASS
    DB_CONNECTION="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
else
    # Extract database name from DATABASE_URL
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_CONNECTION="psql $DATABASE_URL"
    echo -e "${GREEN}Using DATABASE_URL from environment${NC}"
    echo "Database: $DB_NAME"
fi

# Get timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_before_metadata_migration_${TIMESTAMP}.sql"
MIGRATION_FILE="prisma/migrations/migrate_metadata_to_columns/migration.sql"

echo -e "\n${YELLOW}Step 1: Creating database backup...${NC}"
echo "Backup file: $BACKUP_FILE"

if [ -z "$PGPASSWORD" ] && [ -z "$DATABASE_URL" ]; then
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE
else
    if [ -z "$DATABASE_URL" ]; then
        pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE
    else
        pg_dump $DATABASE_URL > $BACKUP_FILE
    fi
fi

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully (Size: $BACKUP_SIZE)${NC}"
else
    echo -e "${RED}✗ Backup failed! Please check your database connection.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Reviewing migration file...${NC}"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}✗ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Migration file found${NC}"

echo -e "\n${YELLOW}Step 3: Running migration...${NC}"
echo "This will:"
echo "  - Add new columns to Post and McqQuestion tables"
echo "  - Migrate data from metadata JSONB to columns"
echo "  - Create indexes for performance"
echo ""
read -p "Do you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

if [ -z "$DATABASE_URL" ]; then
    $DB_CONNECTION -f $MIGRATION_FILE
else
    psql $DATABASE_URL -f $MIGRATION_FILE
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
else
    echo -e "${RED}✗ Migration failed!${NC}"
    echo -e "${YELLOW}You can restore from backup: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 4: Generating Prisma client...${NC}"
npx prisma generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma client generated successfully!${NC}"
else
    echo -e "${RED}✗ Prisma client generation failed!${NC}"
    exit 1
fi

echo -e "\n${GREEN}=== Migration Complete ===${NC}"
echo -e "${GREEN}✓ Backup saved: $BACKUP_FILE${NC}"
echo -e "${GREEN}✓ Database migrated${NC}"
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test your application thoroughly"
echo "2. Update frontend code (see FRONTEND_MIGRATION_GUIDE.md)"
echo "3. Verify all create/update/read operations work correctly"
echo ""
echo -e "${YELLOW}If you need to rollback:${NC}"
echo "psql $DATABASE_URL < $BACKUP_FILE"


