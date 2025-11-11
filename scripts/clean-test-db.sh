#!/bin/bash

# Clean test database script
# Truncates all tables in the test database

set -e

echo "🧹 Cleaning test database..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL_TEST is set
if [ -z "$DATABASE_URL_TEST" ]; then
  echo "❌ DATABASE_URL_TEST is not set in .env file"
  exit 1
fi

# Confirm action
read -p "⚠️  This will delete all data in the test database. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted."
  exit 1
fi

# Tables to clean (in reverse order to respect foreign keys)
TABLES=(
  "promotion_comparisons"
  "missing_casinos"
  "casinos"
  "research_jobs"
  "scheduled_jobs"
)

# Clean each table
for table in "${TABLES[@]}"; do
  echo "  Truncating table: $table"
  DATABASE_URL=$DATABASE_URL_TEST npx prisma db execute --stdin <<< "TRUNCATE TABLE \"$table\" RESTART IDENTITY CASCADE;" > /dev/null 2>&1 || echo "    ⚠️  Table $table might not exist or is already empty"
done

echo "✅ Test database cleaned!"

