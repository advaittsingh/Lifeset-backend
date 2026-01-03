FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Generate Prisma Client (will use DATABASE_URL from runtime, but needs schema)
RUN npx prisma generate
RUN npm run build

FROM node:20-slim

# Install OpenSSL for Prisma and curl for health checks
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production
# Install ts-node for running seed script
RUN npm install -g ts-node typescript
# Generate Prisma Client in production stage (needs to match runtime platform)
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
# Copy seed script for database seeding
COPY prisma/seed.ts ./prisma/seed.ts

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]

