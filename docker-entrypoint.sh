#!/bin/sh

echo "🚀 Starting LifeSet Backend..."

# Check if database is empty (no _prisma_migrations table)
echo "🔍 Checking database state..."
MIGRATE_STATUS=$(npx prisma migrate status 2>&1 || echo "error")
if echo "$MIGRATE_STATUS" | grep -q "_prisma_migrations"; then
  echo "📦 Database has migrations table. Running migrations..."
  # Resolve any failed migrations first
  echo "🔧 Checking for failed migrations..."
  npx prisma migrate resolve --rolled-back add_all_profile_fields 2>/dev/null || true
  
  # Run Prisma migrations
  npx prisma migrate deploy || {
    echo "⚠️  Migration failed, but continuing startup..."
  }
else
  echo "📦 Database appears empty. Pushing schema from Prisma..."
  if npx prisma db push --accept-data-loss --skip-generate; then
    echo "✅ Schema pushed successfully. Seeding database..."
    npx ts-node prisma/seed.ts || {
      echo "⚠️  Seed failed, but continuing startup..."
    }
  else
    echo "⚠️  Schema push failed, trying migrations instead..."
    npx prisma migrate deploy || {
      echo "⚠️  Migrations also failed, but continuing startup..."
    }
  fi
fi

# Start the application
echo "✅ Database setup complete. Starting application..."
exec node dist/main
