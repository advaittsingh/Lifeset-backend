#!/bin/bash

# Script to import SQL backup files into MySQL
# This script imports the two backup files:
# - lifesxtr_lifeset_iktac_db.sql (main database)
# - lifesxtr_blogpost.sql (blog/MCQ database)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory (2 levels up from scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_ROOT"

# SQL backup files location
MAIN_DB_BACKUP="$PROJECT_ROOT/lifesxtr_lifeset_iktac_db.sql"
BLOG_DB_BACKUP="$PROJECT_ROOT/lifesxtr_blogpost.sql"

# Database configuration (can be overridden by environment variables)
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-lifesxtr_lifesiku}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-N.Kc,JAX)f7C}"
MAIN_DB_NAME="${MAIN_DB_NAME:-lifesxtr_lifeset_iktac_db}"
BLOG_DB_NAME="${BLOG_DB_NAME:-lifesxtr_blogpost}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MySQL Database Import Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if backup files exist
if [ ! -f "$MAIN_DB_BACKUP" ]; then
    echo -e "${RED}❌ Error: Main database backup not found at:${NC}"
    echo "   $MAIN_DB_BACKUP"
    exit 1
fi

if [ ! -f "$BLOG_DB_BACKUP" ]; then
    echo -e "${YELLOW}⚠️  Warning: Blog database backup not found at:${NC}"
    echo "   $BLOG_DB_BACKUP"
    echo "   Continuing with main database only..."
    BLOG_DB_BACKUP=""
fi

# Test MySQL connection
echo -e "${YELLOW}Testing MySQL connection...${NC}"
if ! mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to MySQL server${NC}"
    echo "   Host: $MYSQL_HOST"
    echo "   Port: $MYSQL_PORT"
    echo "   User: $MYSQL_USER"
    echo ""
    echo "Please check:"
    echo "   1. MySQL server is running"
    echo "   2. Credentials are correct"
    echo "   3. User has necessary privileges"
    exit 1
fi
echo -e "${GREEN}✅ MySQL connection successful${NC}"
echo ""

# Create databases if they don't exist
echo -e "${YELLOW}Creating databases if they don't exist...${NC}"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$MAIN_DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
echo -e "${GREEN}✅ Main database ready: $MAIN_DB_NAME${NC}"

if [ -n "$BLOG_DB_BACKUP" ]; then
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`$BLOG_DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    echo -e "${GREEN}✅ Blog database ready: $BLOG_DB_NAME${NC}"
fi
echo ""

# Ask for confirmation before importing
echo -e "${YELLOW}⚠️  WARNING: This will import data into the following databases:${NC}"
echo "   - $MAIN_DB_NAME"
if [ -n "$BLOG_DB_BACKUP" ]; then
    echo "   - $BLOG_DB_NAME"
fi
echo ""
echo -e "${YELLOW}This may overwrite existing data.${NC}"
read -p "Do you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Import cancelled.${NC}"
    exit 0
fi

# Import main database
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Importing Main Database${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Importing: $MAIN_DB_BACKUP${NC}"
echo "This may take a few minutes..."

if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MAIN_DB_NAME" < "$MAIN_DB_BACKUP"; then
    echo -e "${GREEN}✅ Main database imported successfully${NC}"
else
    echo -e "${RED}❌ Error importing main database${NC}"
    exit 1
fi
echo ""

# Import blog database
if [ -n "$BLOG_DB_BACKUP" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Importing Blog Database${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}Importing: $BLOG_DB_BACKUP${NC}"
    echo "This may take a few minutes..."

    if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$BLOG_DB_NAME" < "$BLOG_DB_BACKUP"; then
        echo -e "${GREEN}✅ Blog database imported successfully${NC}"
    else
        echo -e "${RED}❌ Error importing blog database${NC}"
        exit 1
    fi
    echo ""
fi

# Show summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Import Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Import completed successfully!${NC}"
echo ""
echo "Imported databases:"
echo "   - $MAIN_DB_NAME"
if [ -n "$BLOG_DB_BACKUP" ]; then
    echo "   - $BLOG_DB_NAME"
fi
echo ""
echo "Next steps:"
echo "   1. Verify the data:"
echo "      mysql -h $MYSQL_HOST -u $MYSQL_USER -p'$MYSQL_PASSWORD' $MAIN_DB_NAME -e 'SHOW TABLES;'"
echo ""
echo "   2. Update your .env file in the backend directory:"
echo "      DATABASE_URL=\"mysql://$MYSQL_USER:$MYSQL_PASSWORD@$MYSQL_HOST:$MYSQL_PORT/$MAIN_DB_NAME?schema=public\""
echo ""
echo "   3. Run Prisma migrations if needed:"
echo "      cd $BACKEND_DIR"
echo "      npx prisma migrate dev"
echo ""
echo -e "${GREEN}Done!${NC}"














