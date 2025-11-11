#!/bin/bash

# Migration script for Casino Research Assistant Backend
# Runs database migrations on development and test databases

set -e

echo "🔄 Running database migrations..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set in .env file"
  exit 1
fi

# Check if DATABASE_URL_TEST is set
if [ -z "$DATABASE_URL_TEST" ]; then
  echo "❌ DATABASE_URL_TEST is not set in .env file"
  exit 1
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Run migrations on development database
echo "🗄️  Running migrations on development database..."
npx prisma migrate deploy

# Run migrations on test database
echo "🧪 Running migrations on test database..."
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy

echo "✅ Migrations completed!"

