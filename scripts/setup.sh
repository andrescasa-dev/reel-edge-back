#!/bin/bash

# Setup script for Casino Research Assistant Backend
# This script sets up the development and test databases

set -e

echo "🚀 Setting up Casino Research Assistant Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your configuration."
  else
    echo "❌ .env.example not found. Please create .env manually."
    exit 1
  fi
fi

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

echo "📦 Installing dependencies..."
npm install

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Setting up development database..."
echo "Running migrations on development database..."
npx prisma migrate dev

echo "🧪 Setting up test database..."
echo "Running migrations on test database..."
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify your .env file has all required variables"
echo "2. Start the development server: npm run start:dev"
echo "3. Access Swagger documentation at http://localhost:3000/api/docs"

