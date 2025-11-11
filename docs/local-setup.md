# Local Setup Guide

This guide will help you set up the Casino Research Assistant backend for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (LTS version, 18.x or higher)
- **PostgreSQL** (14.x or higher)
- **npm** or **pnpm** package manager
- **Git**

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd casino-research-back
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Set Up PostgreSQL Databases

You need two PostgreSQL databases:
1. **Development database** - for running the application
2. **Test database** - for running tests

### Option A: Using Docker Compose

If you have Docker installed, you can use the provided `docker-compose.yml`:

```bash
docker-compose up -d
```

This will start PostgreSQL on `localhost:5432` with:
- Database: `casino_research`
- User: `postgres`
- Password: `postgres`

### Option B: Manual PostgreSQL Setup

1. **Create development database**:
   ```bash
   createdb casino_research
   ```

2. **Create test database**:
   ```bash
   createdb casino_research_test
   ```

## Step 4: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Application
NODE_ENV=development
PORT=3000

# PostgreSQL Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/casino_research
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=casino_research

# Testing
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/casino_research_test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=casino_research_test

# Perplexity API
PERPLEXITY_API_KEY=your-perplexity-api-key-here

# Reel Edge DB
REEL_EDGE_API_URL=https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0

# Research Settings
RESEARCH_SCHEDULE_CRON=0 0 * * *
PERPLEXITY_RATE_LIMIT_RPM=20
PROMOTION_BATCH_SIZE=7

# NextAuth (for session validation)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3001

# CORS
CORS_ORIGIN=http://localhost:3001
```

**Important**: Replace placeholder values with your actual credentials and API keys.

## Step 5: Run Database Migrations

### Development Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### Test Database

```bash
# Run migrations on test database
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
```

## Step 6: Verify Database Setup

You can verify your database setup using Prisma Studio:

```bash
# For development database
npx prisma studio

# For test database
DATABASE_URL=$DATABASE_URL_TEST npx prisma studio
```

Prisma Studio will open in your browser at `http://localhost:5555`.

## Step 7: Start the Development Server

```bash
npm run start:dev
```

The application will start on `http://localhost:3000` (or the port specified in `PORT`).

You should see:
```
Application is running on: http://localhost:3000
Swagger documentation available at: http://localhost:3000/api/docs
```

## Step 8: Verify Installation

1. **Check Swagger Documentation**:
   - Open `http://localhost:3000/api/docs`
   - You should see the API documentation

2. **Test API Endpoints**:
   ```bash
   # Get state stats
   curl http://localhost:3000/dashboard/state-stats

   # Get missing casinos
   curl http://localhost:3000/missing-casinos
   ```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Run Tests with Coverage

```bash
npm run test:cov
```

**Important**: Tests use a separate test database (`DATABASE_URL_TEST`). Make sure this database is set up and migrations are applied.

## Common Issues

### Database Connection Errors

**Error**: `Can't reach database server`

**Solutions**:
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` is correct
- Verify database exists: `psql -l`
- Check firewall/network settings

### Migration Errors

**Error**: `Migration failed`

**Solutions**:
- Check database user has necessary permissions
- Verify database exists
- Try resetting migrations: `npx prisma migrate reset` (⚠️ This will delete all data)

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solutions**:
- Change `PORT` in `.env` file
- Kill the process using port 3000:
  ```bash
  # Find process
  lsof -i :3000
  
  # Kill process
  kill -9 <PID>
  ```

### Missing Environment Variables

**Error**: `Configuration validation failed`

**Solutions**:
- Verify `.env` file exists
- Check all required variables are set
- Review error messages for missing variables

## Development Workflow

### Making Database Changes

1. **Modify Prisma Schema** (`prisma/schema.prisma`)
2. **Create Migration**:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```
3. **Apply to Test Database**:
   ```bash
   DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
   ```

### Code Formatting

```bash
# Format code
npm run format

# Lint code
npm run lint
```

### Building for Production

```bash
npm run build
```

The compiled code will be in the `dist/` directory.

## Project Structure

```
casino-research-back/
├── src/
│   ├── modules/          # Feature modules
│   │   ├── dashboard/
│   │   ├── casino-discovery/
│   │   ├── promotion-research/
│   │   ├── research-orchestration/
│   │   └── shared/
│   ├── config/           # Configuration
│   └── main.ts           # Application entry point
├── test/                  # Test files
│   ├── e2e/              # E2E tests
│   └── helpers/          # Test utilities
├── prisma/               # Database schema and migrations
├── docs/                 # Documentation
└── scripts/              # Utility scripts
```

## Next Steps

- Read [Testing Guide](./testing.md) for testing guidelines
- Read [Deployment Guide](./deployment.md) for production deployment
- Explore the API using Swagger UI at `http://localhost:3000/api/docs`
- Review the codebase structure and architecture

## Getting Help

- Check the [README.md](../README.md) for overview
- Review [Testing Guide](./testing.md) for test setup
- Consult [Deployment Guide](./deployment.md) for production setup
- Check application logs for errors
- Review Prisma documentation: https://www.prisma.io/docs

