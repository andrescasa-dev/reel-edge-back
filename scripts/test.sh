#!/bin/bash

# Test script for Casino Research Assistant Backend
# Runs all tests sequentially

set -e

echo "🧪 Running tests..."

# Check if DATABASE_URL_TEST is set
if [ -z "$DATABASE_URL_TEST" ]; then
  echo "⚠️  DATABASE_URL_TEST is not set. Loading from .env..."
  if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
  fi
  
  if [ -z "$DATABASE_URL_TEST" ]; then
    echo "❌ DATABASE_URL_TEST is not set. Please set it in .env file"
    exit 1
  fi
fi

# Verify test database exists
echo "🔍 Verifying test database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo "⚠️  Test database connection failed. Make sure:"
  echo "   1. Test database exists"
  echo "   2. DATABASE_URL_TEST is correct"
  echo "   3. Database is accessible"
  exit 1
fi

# Run migrations on test database if needed
echo "🔄 Ensuring test database migrations are up to date..."
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy > /dev/null 2>&1 || true

# Run tests
echo "▶️  Running all tests sequentially..."
npm test -- --runInBand

echo "✅ Tests completed!"

