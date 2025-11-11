# Casino Research Assistant Backend

A NestJS backend application for managing casino research data, discovering missing casinos, and comparing promotions across NJ, MI, PA, and WV jurisdictions.

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- npm or pnpm

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd casino-research-back
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required environment variables:

   ```bash
   # Application
   NODE_ENV=development
   PORT=3000

   # Database (Docker Compose)
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   POSTGRES_DB=casino_research

   # Database URLs
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/casino_research
   DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/casino_research_test

   # External APIs
   PERPLEXITY_API_KEY=pplx-xxxxx
   REEL_EDGE_API_URL=https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0

   # Research Settings (pueden dejarse así tal cual, ya que son configuraciones recomendadas)
   RESEARCH_SCHEDULE_CRON=0 0 * * *
   PERPLEXITY_RATE_LIMIT_RPM=20
   PROMOTION_BATCH_SIZE=5

   # CORS
   CORS_ORIGIN=http://localhost:3001
   ```

   See `.env.example` for a complete template.

4. **Set up databases**:

   ```bash
   # Start PostgreSQL using Docker Compose
   docker-compose up -d
   ```

5. **Run migrations**:

   ```bash
   # Development database
   npx prisma migrate dev
   ```

6. **Start the development server**:
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3000` and Swagger documentation at `http://localhost:3000/api/docs`.

For detailed setup instructions, see [Local Setup Guide](./docs/local-setup.md).

## Overview

The Casino Research Assistant backend provides APIs for:

- **Casino Discovery**: Automatically discover licensed casinos using AI-powered search
- **Promotion Research**: Research and compare casino promotions in batches
- **Missing Casino Tracking**: Track casinos found in regulatory sources but missing from the database
- **Promotion Comparisons**: Compare discovered promotions with existing ones to identify better offers

## Architecture

The backend follows **Clean Architecture** principles with clear separation of concerns:

- **Presentation Layer**: Controllers, DTOs, Exception Filters
- **Application Layer**: Services, Business Logic
- **Domain Layer**: Entities, Value Objects, Enums, Repository Interfaces
- **Infrastructure Layer**: Repository Implementations, External API Clients, Database

### Technology Stack

- **Runtime**: Node.js (LTS)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **AI Integration**: Perplexity API (Search & Sonar)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest (unit), Supertest (e2e)
- **Documentation**: Swagger/OpenAPI

## Project Structure

```
casino-research-back/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── dashboard/       # Dashboard statistics and research control
│   │   ├── casino-discovery/ # Casino discovery using Perplexity Search
│   │   ├── promotion-research/ # Promotion research and comparison
│   │   ├── research-orchestration/ # Research workflow orchestration
│   │   └── shared/           # Shared utilities, entities, clients
│   ├── config/               # Configuration and validation
│   └── main.ts               # Application entry point
├── test/
│   ├── e2e/                  # End-to-end tests
│   └── helpers/              # Test utilities
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/          # Database migrations
├── docs/                     # Documentation
│   ├── deployment.md         # Deployment guide
│   ├── local-setup.md       # Local setup guide
│   └── testing.md           # Testing guide
└── scripts/                  # Utility scripts
```

## API Documentation

### Swagger UI

Once the application is running, access the interactive API documentation at:

```
http://localhost:3000/api/docs
```

### API Endpoints

#### Dashboard

- `GET /dashboard/state-stats` - Get state-level statistics
- `POST /dashboard/research-status` - Start or stop research

#### Missing Casinos

- `GET /missing-casinos` - List missing casinos with filters and pagination

#### Promotion Comparisons

- `GET /promotions/comparisons` - List promotion comparisons with filters and pagination
- `PATCH /promotions/comparisons/:comparisonId` - Update comparison status

For detailed API documentation, see the Swagger UI or refer to the [API specification](../AI-context/api.json).

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:cov
```

**Test Statistics:**

- Test Suites: 12 passed, 12 total
- Tests: 163 passed, 163 total

### Testing Guidelines

The project follows strict testing principles:

- **Real Database**: Use separate test database (`DATABASE_URL_TEST`) - never mock the database
- **Database Cleanup**: Clean database before each test
- **Sequential Execution**: Tests run sequentially to avoid race conditions
- **Mock External Services**: Mock all external APIs (Perplexity, Reel Edge)
- **Test Independence**: Each test sets up its own data

For detailed testing guidelines, see [Testing Guide](./docs/testing.md).

## Development

### Available Scripts

```bash
# Development
npm run start:dev      # Start development server with hot reload
npm run start:debug    # Start with debugging enabled
npm run start:prod    # Start production server

# Building
npm run build         # Build for production

# Code Quality
npm run format        # Format code with Prettier
npm run lint          # Lint code with ESLint

# Testing
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:cov      # Run tests with coverage
npm run test:e2e      # Run E2E tests
```

### Database Management

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Code Style

The project follows TypeScript and NestJS best practices:

- Use TypeScript strict mode
- Follow Clean Architecture principles
- Use dependency injection
- Write self-documenting code
- Add JSDoc comments for public APIs

See [AGENT.md](./AGENT.md) for detailed coding guidelines.

## Features

### Casino Discovery

- Uses Perplexity Search API to discover licensed casinos
- Prioritizes official gaming commission sources
- Compares against Reel Edge DB to identify missing casinos
- Stores missing casino records with metadata

### Promotion Research

- Batch processing (5-10 casinos per request)
- Uses Perplexity Sonar API for promotion discovery
- Traditional comparison logic (better/alternative/new)
- Filters expired and worse promotions
- Tracks promotion comparisons with status

### Research Orchestration

- Coordinates full research workflow
- Fetches Reel Edge data once per job
- Processes states sequentially (NJ, MI, PA, WV)
- PostgreSQL-based job scheduling
- Error recovery and progress tracking

### Dashboard

- State-level statistics aggregation
- Research status management
- Missing casino counts
- Pending comparison counts

### Rate Limiting

- Sliding window algorithm with request queue
- Configurable requests per minute (default: 20 RPM)
- Minimum delay enforcement between requests (3 seconds)
- Automatic request queuing when rate limit is reached
- Handles Perplexity API rate limit errors with retry logic
- Prevents API throttling and ensures reliable external API usage
