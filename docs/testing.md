# Testing Guide

This document outlines the testing strategy, guidelines, and best practices for the Casino Research Assistant backend.

## Testing Philosophy

The project follows these critical testing principles:

1. **Real Database Testing**: Use a separate test database (`DATABASE_URL_TEST`) - **never mock the database**
2. **Database Cleanup**: Clean test database before each test (`beforeEach` hooks)
3. **Sequential Execution**: Run all tests sequentially (`--runInBand` flag) to avoid race conditions
4. **Mock External Services**: Mock all external APIs (Perplexity API, Reel Edge API) - **never mock database**
5. **Test Independence**: Tests must be context-independent and independent of each other
6. **Self-Contained Tests**: Each test should set up its own data and clean up after itself

## Test Database Setup

### Prerequisites

1. **Separate Test Database**: Create a dedicated PostgreSQL database for testing:
   ```bash
   createdb casino_research_test
   ```

2. **Environment Variable**: Set `DATABASE_URL_TEST` in your `.env` file:
   ```bash
   DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/casino_research_test
   ```

3. **Run Migrations**: Apply migrations to test database:
   ```bash
   DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
   ```

### Database Cleanup

The test suite includes a database cleanup helper that truncates all tables before each test:

```typescript
import { cleanDatabase } from '../helpers/database-cleanup.helper';
import { PrismaService } from '../../src/modules/shared/infrastructure/database/prisma/prisma.service';

beforeEach(async () => {
  await cleanDatabase(prismaService);
});
```

**Important**: Always clean the database before each test to ensure test isolation.

## Test Structure

### Unit Tests

Unit tests focus on business logic in services and domain models.

**Location**: `src/modules/**/__tests__/*.spec.ts`

**Example**:
```typescript
describe('PromotionResearchService', () => {
  let service: PromotionResearchService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    await cleanDatabase(prismaService);
  });

  it('should compare promotions correctly', async () => {
    // Test implementation
  });
});
```

**Guidelines**:
- Mock external dependencies (Perplexity, Reel Edge)
- Use real database for persistence
- Test business logic in isolation
- Aim for 70-80% coverage on service layer

### Integration Tests

Integration tests verify API endpoints with real database.

**Location**: `test/e2e/*.e2e-spec.ts`

**Example**:
```typescript
describe('API Contracts (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeEach(async () => {
    await cleanDatabase(prismaService);
  });

  it('should return state stats', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/state-stats')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
  });
});
```

**Guidelines**:
- Use Supertest for HTTP requests
- Use real test database
- Mock external APIs
- Test request/response schemas
- Test error handling

### E2E Tests

E2E tests verify complete workflows from start to finish.

**Location**: `test/e2e/research-workflow.e2e-spec.ts`

**Example**:
```typescript
describe('Research Workflow (e2e)', () => {
  it('should complete full research workflow', async () => {
    // Mock external APIs
    jest.spyOn(reelEdgeClient, 'fetchAllActiveData').mockResolvedValue(...);
    
    // Start research
    await request(app.getHttpServer())
      .post('/dashboard/research-status')
      .send({ action: 'start' })
      .expect(200);
    
    // Verify results in database
    const comparisons = await prismaService.promotionComparison.findMany();
    expect(comparisons.length).toBeGreaterThan(0);
  });
});
```

**Guidelines**:
- Test complete user workflows
- Mock external APIs
- Verify database state
- Test error recovery
- Verify batching behavior

## Running Tests

### Run All Tests

```bash
npm test
```

This runs all tests sequentially with `--runInBand` flag.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test -- path/to/test.spec.ts
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Run Tests with Coverage

```bash
npm run test:cov
```

Coverage report will be generated in `coverage/` directory.

## Mocking External Services

### Mocking Perplexity API

```typescript
jest.spyOn(perplexitySearchClient, 'searchCasinos').mockResolvedValue({
  casinos: [
    {
      name: 'Test Casino',
      website: 'https://test.com',
      regulatoryId: 'NJ-001',
      state: StateAbbreviation.NJ,
    },
  ],
  citations: ['https://nj.gov/gaming'],
});
```

### Mocking Reel Edge API

```typescript
jest.spyOn(reelEdgeClient, 'fetchAllActiveData').mockResolvedValue({
  casinos: [
    {
      id: '1',
      casinodb_id: 1,
      name: 'Test Casino',
      state: StateAbbreviation.NJ,
      website: 'https://test.com',
      regulatoryId: 'NJ-001',
    },
  ],
  promotions: [],
});
```

**Important**: Never call real external APIs in tests. Always mock them.

## Test Data Management

### Creating Test Data

Use Prisma Client directly to create test data:

```typescript
const casino = await prismaService.casino.create({
  data: {
    id: 'casino-1',
    casinodb_id: 1,
    name: 'Test Casino',
    state: StateAbbreviation.NJ,
    website: 'https://test.com',
    regulatoryId: 'NJ-001',
  },
});
```

### Test Data Builders (Optional)

For complex test data, consider creating test data builders:

```typescript
function createTestCasino(overrides = {}) {
  return {
    id: 'casino-1',
    casinodb_id: 1,
    name: 'Test Casino',
    state: StateAbbreviation.NJ,
    ...overrides,
  };
}
```

## Best Practices

### 1. Test Independence

Each test should be independent and not rely on other tests:

```typescript
// ❌ Bad: Relies on previous test
it('should update existing casino', async () => {
  // Assumes casino from previous test exists
  const casino = await repository.findById('casino-1');
});

// ✅ Good: Sets up own data
it('should update existing casino', async () => {
  const casino = await repository.create(createTestCasino());
  const updated = await repository.update(casino.id, { name: 'Updated' });
  expect(updated.name).toBe('Updated');
});
```

### 2. Database Cleanup

Always clean database before each test:

```typescript
beforeEach(async () => {
  await cleanDatabase(prismaService);
});
```

### 3. Use Real Database

Never mock Prisma or database layer:

```typescript
// ❌ Bad: Mocking database
jest.mock('@prisma/client');

// ✅ Good: Using real database
const module = await Test.createTestingModule({
  providers: [Repository, PrismaService],
}).compile();
```

### 4. Mock External Services

Always mock external APIs:

```typescript
// ✅ Good: Mocking external API
jest.spyOn(perplexityClient, 'searchCasinos').mockResolvedValue(...);
```

### 5. Sequential Execution

Tests run sequentially to avoid race conditions. This is configured in `jest.config.js`:

```javascript
module.exports = {
  maxWorkers: 1, // Sequential execution
};
```

### 6. Test Timeouts

Increase timeout for tests that interact with database:

```typescript
jest.setTimeout(30000); // 30 seconds
```

## Common Testing Patterns

### Testing Repository Methods

```typescript
describe('CasinoRepository', () => {
  it('should create a casino', async () => {
    const casino = await repository.create({
      casinodb_id: 1,
      name: 'Test Casino',
      state: StateAbbreviation.NJ,
    });
    
    expect(casino.id).toBeDefined();
    expect(casino.name).toBe('Test Casino');
  });
});
```

### Testing Service Methods

```typescript
describe('DashboardService', () => {
  it('should return state stats', async () => {
    // Set up test data
    await prismaService.casino.create({ data: {...} });
    
    // Execute
    const stats = await service.getStateStats();
    
    // Verify
    expect(stats.length).toBeGreaterThan(0);
  });
});
```

### Testing API Endpoints

```typescript
describe('DashboardController (e2e)', () => {
  it('should return state stats', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/state-stats')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('timestamp');
  });
});
```

## Troubleshooting

### Tests Failing Due to Database State

**Problem**: Tests fail because database contains data from previous tests.

**Solution**: Ensure `beforeEach` hook cleans database:
```typescript
beforeEach(async () => {
  await cleanDatabase(prismaService);
});
```

### Tests Timing Out

**Problem**: Tests timeout when interacting with database.

**Solution**: Increase timeout:
```typescript
jest.setTimeout(30000);
```

### Database Connection Errors

**Problem**: `Can't reach database server`

**Solution**:
- Verify `DATABASE_URL_TEST` is set correctly
- Check test database exists
- Verify migrations are applied

### Race Conditions

**Problem**: Tests fail intermittently due to race conditions.

**Solution**: Ensure tests run sequentially (`--runInBand` flag is set).

## Test Coverage Goals

- **Service Layer**: 70-80% coverage
- **Repository Layer**: 80-90% coverage
- **Controllers**: 60-70% coverage (focus on critical paths)
- **Domain Logic**: 90%+ coverage

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: casino_research_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npx prisma generate
      - run: DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/casino_research_test npx prisma migrate deploy
      - run: npm test
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

