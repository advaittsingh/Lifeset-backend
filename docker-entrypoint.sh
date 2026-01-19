#!/bin/sh

echo "🚀 Starting LifeSet Backend..."

# Setup SSL certificates if provided
if [ -n "$SSL_CERT_CONTENT" ] && [ -n "$SSL_KEY_CONTENT" ]; then
  echo "🔐 Setting up SSL certificates..."
  mkdir -p /tmp/ssl
  echo "$SSL_CERT_CONTENT" > /tmp/ssl/cert.pem
  echo "$SSL_KEY_CONTENT" > /tmp/ssl/key.pem
  chmod 600 /tmp/ssl/key.pem
  chmod 644 /tmp/ssl/cert.pem
  export SSL_CERT_PATH=/tmp/ssl/cert.pem
  export SSL_KEY_PATH=/tmp/ssl/key.pem
  echo "✅ SSL certificates configured at /tmp/ssl/"
else
  echo "ℹ️  SSL certificates not provided, using HTTP"
fi

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
