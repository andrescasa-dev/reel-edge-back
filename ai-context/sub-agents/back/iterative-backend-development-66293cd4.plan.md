<!-- 66293cd4-e092-4af2-b5be-04dd7956254a aa9fccc0-f0d1-4041-8d82-c8f385e8c858 -->
# Iterative Backend Development - Milestones

## Testing Guidelines (Applied to All Milestones)

**Critical Testing Principles**:

- Use separate test database (`DATABASE_URL_TEST`) - never mock the database
- Clean test database before each test (`beforeEach` hooks)
- Run all tests sequentially (`--runInBand` flag) to avoid race conditions
- Mock all external services (Perplexity API, Reel Edge API) - never mock database
- Tests must be context-independent and independent of each other
- Each test should set up its own data and clean up after itself

---

## Milestone 1: Project Setup & Domain Foundation (2-3 days)

**Goal**: Establish project structure, domain layer, and test infrastructure

**Deliverables**:

- NestJS project initialized with TypeScript configuration
- Prisma configured with PostgreSQL connection
- Separate test database configured
- Environment variables and ConfigModule set up
- Complete domain layer structure created
- Jest configured for sequential test execution

**Tasks**:

1. Initialize NestJS project with `@nestjs/cli`
2. Install dependencies: Prisma, class-validator, class-transformer, Axios
3. Create `.env.example` with `DATABASE_URL` and `DATABASE_URL_TEST`
4. Implement ConfigModule with validation schema
5. Configure Jest in `jest.config.js`:

- Set `--runInBand` flag for sequential execution
- Configure test environment to use `DATABASE_URL_TEST`
- Set up global test teardown/setup hooks

6. Create test utilities in `test/helpers/`:

- `database-cleanup.helper.ts` - clean all tables before each test
- `test-data-builder.ts` - build test data objects

7. Create domain entities in `src/modules/shared/domain/entities/`:

- `casino.entity.ts`
- `state.entity.ts`
- `missing-casino.entity.ts` (in casino-discovery module)
- `promotion.entity.ts`
- `promotion-comparison.entity.ts`
- `research-job.entity.ts`

8. Create domain enums in `src/modules/shared/domain/enums/`:

- `state.enum.ts` (NJ, MI, PA, WV)
- `comparison-type.enum.ts` (BETTER, ALTERNATIVE, NEW)
- `comparison-status.enum.ts` (PENDING, UPDATED, REVIEWED, IGNORED)
- `research-status.enum.ts` (IDLE, RESEARCHING)

9. Create value objects:

- `promotion-value.vo.ts` (bonus comparison logic)
- `state-set.vo.ts` (state validation)

10. Define repository interfaces in each module's domain layer
11. Set up module structure following Clean Architecture pattern

**Validation**:

- Project builds without errors (`npm run build`)
- All domain entities and enums are properly typed
- ConfigModule loads environment variables correctly
- Test database connection successful
- Jest runs tests sequentially

**Testing**:

- Unit tests for value objects (PromotionValue, StateSet)
- Enum validation tests
- Verify sequential test execution works
- Verify database cleanup helper works correctly

---

## Milestone 2: Database Schema & Repositories (2-3 days)

**Goal**: Design database schema and implement repository pattern with real database testing

**Deliverables**:

- Complete Prisma schema with all models and relationships
- Initial database migration created and applied
- All repository implementations with CRUD operations
- Repository tests using real test database (NO mocking)

**Tasks**:

1. Design Prisma schema in `prisma/schema.prisma`:

- `Casino` model with indexes on state and name
- `MissingCasino` model with state index
- `PromotionComparison` model with composite indexes
- `ResearchJob` model with startedAt index
- `ScheduledJob` model for PostgreSQL-based scheduling

2. Create migration for development: `npx prisma migrate dev --name init`
3. Create migration for test database: `DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy`
4. Generate Prisma Client: `npx prisma generate`
5. Implement repositories in infrastructure layers:

- `casino.repository.ts` - basic CRUD
- `missing-casino.repository.ts` - with search and state filtering
- `promotion-comparison.repository.ts` - with offset-based pagination and multi-field filtering
- `research-job.repository.ts` - basic CRUD with status tracking
- `scheduled-job.repository.ts` - job management queries

6. Each repository should:

- Implement the domain repository interface
- Handle Prisma errors and convert to domain exceptions
- Include query optimization (select specific fields)

7. Create custom domain exceptions:

- `CasinoNotFoundException`
- `ComparisonNotFoundException`
- `InvalidStateException`

**Validation**:

- Database migrations run successfully on both dev and test databases
- All repositories can perform CRUD operations
- Prisma Studio shows correct schema: `npx prisma studio`
- Test database migrations are up to date

**Testing**:

- Tests use REAL test database (connected via `DATABASE_URL_TEST`)
- NO mocking of Prisma or database layer
- Each test file includes `beforeEach(() => cleanDatabase())` hook
- Test each repository with real database operations:
- CRUD operations (create, read, update, delete)
- Error handling (not found, constraint violations)
- Pagination logic for PromotionComparisonRepository
- Filtering logic for MissingCasinoRepository
- Tests run sequentially to avoid race conditions
- Each test is independent (sets up its own data)

---

## Milestone 3: External API Client - Reel Edge DB (2 days)

**Goal**: Implement client to fetch casino and promotion data from Reel Edge DB

**Deliverables**:

- ReelEdgeDBClient with single-fetch caching strategy
- Error handling and retry logic
- Unit tests with mocked HTTP responses (API mocked, database NOT mocked)

**Tasks**:

1. Create `reel-edge.client.ts` in `src/modules/shared/infrastructure/external-apis/reel-edge/`
2. Implement `fetchAllActiveData()` method:

- Endpoint: `GET https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB`
- Returns: `{ casinos: Casino[], promotions: Promotion[] }`
- Single call per research job

3. Configure Axios with:

- Timeout (30 seconds)
- Retry logic (3 attempts with exponential backoff)
- Proper error handling (network errors, timeouts)

4. Transform API response to match internal domain entities
5. Add logging for all requests and responses
6. Create `ReelEdgeAPIException` custom exception

**Validation**:

- Make test call to Reel Edge API and verify data structure
- Verify retry logic triggers on network failures
- Confirm data transformation matches domain entities

**Testing**:

- Use test database for any persistence (NO database mocking)
- MOCK Axios/HTTP calls to Reel Edge API
- Clean database before each test
- Test successful data fetch and transformation
- Test error scenarios (network failure, timeout, invalid response)
- Test retry logic with exponential backoff
- Tests run sequentially and are independent

---

## Milestone 4: External API Clients - Perplexity (3 days)

**Goal**: Implement both Perplexity API clients (Search and Sonar) with rate limiting

**Deliverables**:

- PerplexitySearchClient for casino discovery
- PerplexitySonarClient for promotion research with batch processing
- Rate limiting implementation
- Unit tests with mocked API responses

**Tasks**:

1. Create `perplexity-search.client.ts` in `src/modules/casino-discovery/infrastructure/external-apis/perplexity/`:

- Implement `searchCasinos(state: string)` method
- Use Perplexity Search API (cheaper, no analysis)
- Prompt template for official source prioritization
- Extract casino names, websites, regulatory IDs
- Parse citations into URL array

2. Create `perplexity-sonar.client.ts` in `src/modules/promotion-research/infrastructure/external-apis/perplexity/`:

- Implement `queryPromotionsBatch(casinos: Casino[], existingPromotions: Map<string, Promotion[]>)` method
- Use standard Sonar model (not Sonar Pro)
- Batch 5-10 casinos per request
- Include existing promotions in prompt for context
- Parse batch response and extract citations

3. Implement rate limiting service:

- Track requests per minute (configurable via env var)
- Queue with throttling
- Add delays between batch requests (3-5 seconds)
- Handle 429 errors with exponential backoff

4. Create structured prompt templates for both clients
5. Add comprehensive logging (raw prompts and responses)
6. Create `PerplexityAPIException` custom exception

**Validation**:

- Test Search API with real state query (NJ) - optional, can mock
- Test Sonar API with batch of 5 casinos - optional, can mock
- Verify rate limiting prevents exceeding API limits
- Confirm citation extraction works correctly

**Testing**:

- MOCK all Perplexity API calls (never call real API in tests)
- Use real test database for any persistence (NO database mocking)
- Clean database before each test
- Test PerplexitySearchClient with mocked API responses
- Test PerplexitySonarClient with mocked batch responses
- Test rate limiting logic (request throttling, queue management)
- Test error handling (API errors, 429 responses, invalid responses)
- Test prompt generation and response parsing
- Tests run sequentially and are independent

---

## Milestone 5: Casino Discovery Service (2-3 days)

**Goal**: Implement casino discovery logic with comparison against Reel Edge data

**Deliverables**:

- CasinoDiscoveryService with all discovery methods
- Comparison logic to identify missing casinos
- Integration with PerplexitySearchClient and cached Reel Edge data
- Service tests using real database

**Tasks**:

1. Create `casino-discovery.service.ts` in `src/modules/casino-discovery/application/services/`
2. Implement key methods:

- `discoverCasinosForState(state: StateAbbreviation, cachedReelEdgeData)`:
- Query Perplexity Search API for state
- Parse AI response for casino list
- Compare against cached Reel Edge casinos
- Return missing casinos
- `getMissingCasinos(filters)`:
- Query repository with state/search filters
- Support pagination
- `compareCasinoLists(discovered, existing)`:
- Fuzzy matching logic (handle name variations)
- Identify truly missing casinos
- `enrichCasinoMetadata(casino)`:
- Get additional details (website, regulatory ID)
- Use Perplexity for missing data

3. Store missing casinos in database via repository
4. Handle edge cases (duplicate names, name variations)
5. Add logging for discovery results

**Validation**:

- Run discovery for one state (e.g., NJ)
- Verify missing casinos are identified correctly
- Check test database for stored missing casino records
- Validate comparison logic with known casino names

**Testing**:

- MOCK PerplexitySearchClient (external service)
- Use REAL test database (NO database mocking)
- Clean database before each test (`beforeEach` hook)
- Test `compareCasinoLists()` with various scenarios (exact match, fuzzy match, no match)
- Test `discoverCasinosForState()` end-to-end flow with mocked Perplexity responses
- Test `getMissingCasinos()` with filters and pagination (real database queries)
- Test error handling when Perplexity API fails
- Verify data persists correctly to database
- Tests run sequentially and are independent

---

## Milestone 6: Promotion Research & Comparison Logic (3-4 days)

**Goal**: Implement promotion research with batching and traditional comparison algorithm

**Deliverables**:

- Traditional comparison logic (better/alternative/new) without AI
- PromotionResearchService with batch processing
- Filtering logic for expired and worse promotions
- Comprehensive tests with real database

**Tasks**:

1. Implement traditional comparison algorithm in `src/modules/promotion-research/domain/value-objects/`:

- Create `determineComparisonType(discovered, existing)` function
- Logic for "NEW": No existing promotion for casino+offer_type
- Logic for "BETTER":
- Bonus ratio >10% higher
- Same bonus, lower deposit
- Similar value, >20% lower wagering
- Logic for "ALTERNATIVE": Default for everything else
- No AI assistance (pure programming logic)

2. Create `promotion-research.service.ts` in `src/modules/promotion-research/application/services/`
3. Implement key methods:

- `researchPromotionsForCasinoBatch(casinos, existingPromotions)`:
- Batch 5-10 casinos per Perplexity request
- Include existing promotions in prompt
- Parse AI response
- Apply traditional comparison logic
- Filter expired promotions (check validUntil)
- Filter significantly worse promotions (>30% worse ratio)
- Create PromotionComparison records
- `comparePromotions(discovered, existing)`:
- Use traditional algorithm
- Return ComparisonType
- `getPromotionComparisons(filters, offset, limit)`:
- Query repository with multi-field filters
- Support offset-based pagination
- `updateComparisonStatus(comparisonId, action)`:
- Handle user actions (update/add/ignore)
- Update status in database

4. Implement filtering logic:

- Expired promotions (validUntil < now)
- Worse promotions (ratio <70% of existing)
- Default to keeping "alternative" when uncertain

5. Add comprehensive logging for comparison results

**Validation**:

- Test comparison logic with known promotion pairs
- Verify "better" promotions are correctly identified
- Run batch research for 5-10 casinos
- Check test database for created PromotionComparison records
- Validate filtering removes expired/worse promotions

**Testing**:

- Unit tests for `determineComparisonType()` function (pure logic, no database):
- Test all "BETTER" scenarios (bonus ratio, lower deposit, lower wagering)
- Test "NEW" scenario (no existing promotion)
- Test "ALTERNATIVE" default case
- Edge cases (equal values, null wagering requirements)
- Service tests for PromotionResearchService:
- MOCK PerplexitySonarClient (external service)
- Use REAL test database (NO database mocking)
- Clean database before each test
- Test batch processing logic with real database persistence
- Test filtering (expired, worse promotions)
- Test `getPromotionComparisons()` with various filters (real database queries)
- Test `updateComparisonStatus()` state transitions (real database updates)
- Integration test: Batch research with mocked Perplexity responses and real database
- Tests run sequentially and are independent

---

## Milestone 7: Research Orchestration & Scheduling (3 days)

**Goal**: Implement orchestration service and PostgreSQL-based job scheduler

**Deliverables**:

- ResearchOrchestrationService coordinating full workflow
- PostgreSQL-based simple job scheduler
- Research progress tracking and error recovery
- Orchestration tests with real database

**Tasks**:

1. Create `research-orchestration.service.ts` in `src/modules/research-orchestration/application/services/`
2. Implement orchestration workflow:

- `startFullResearch()`:
- Create ResearchJob record (status: running)
- Set global research status to "researching"
- Fetch Reel Edge DB data ONCE (cache for job duration)
- Loop through states (NJ, MI, PA, WV) sequentially
- For each state:
- Phase 1: Call CasinoDiscoveryService
- Phase 2: Call PromotionResearchService in batches
- Update ResearchJob (status: completed, results summary)
- Set global research status to "idle"
- `researchState(state, cachedData)`:
- Orchestrate discovery and promotion research for one state
- Use cached Reel Edge data (no refetch)
- `handleResearchError()`:
- Implement retry logic
- Log errors to ResearchJob
- Continue to next state on failure

3. Implement PostgreSQL-based job scheduler in `src/modules/research-orchestration/infrastructure/scheduler/`:

- Create `pg-job-scheduler.ts`
- Use NestJS `@Cron` decorator to check for due jobs every 5 minutes
- Query ScheduledJob table for jobs where `nextRun <= now` and `isActive = true`
- Execute due jobs (call `startFullResearch()`)
- Update `lastRun` and calculate `nextRun` based on cron schedule

4. Implement `scheduleResearch()` method:

- Create/update ScheduledJob record
- Support cron expressions (e.g., "0 0 \* \* \*" for daily at midnight)

5. Add rate limiting coordination between batches
6. Track research progress (states completed, casinos processed)

**Validation**:

- Trigger full research manually
- Verify Reel Edge is fetched only once
- Confirm states are processed sequentially
- Check test database for ResearchJob records with correct status
- Test scheduled job execution (can manipulate time in tests)

**Testing**:

- MOCK all external service dependencies (CasinoDiscoveryService, PromotionResearchService, ReelEdgeClient)
- Use REAL test database for job persistence (NO database mocking)
- Clean database before each test
- Test ResearchOrchestrationService:
- Test full research flow (all states) with real database tracking
- Test single state research with real database updates
- Test error handling and retry logic with real error logging to database
- Verify Reel Edge called only once (through mocked calls verification)
- Test PostgreSQL job scheduler:
- Test job scheduling CRUD operations (real database)
- Test due job detection (real database queries)
- Test job execution triggering
- Test cron expression parsing and nextRun calculation
- Tests run sequentially to avoid job execution conflicts
- Each test is independent and cleans up its data

---

## Milestone 8: Dashboard & API Controllers (2-3 days)

**Goal**: Implement dashboard service and all API controllers with DTOs

**Deliverables**:

- DashboardService for state statistics and research status
- All controllers (Dashboard, MissingCasinos, PromotionComparisons)
- DTOs for request validation and response serialization
- Global exception filter
- Integration tests for API endpoints with real database

**Tasks**:

1. Create `dashboard.service.ts` in `src/modules/dashboard/application/services/`:

- `getStateStats()`:
- Aggregate statistics for all four states
- Count casinos from cached Reel Edge data
- Count missing casinos from repository
- Count promotion comparisons by status
- Return StateStats array
- `startResearch()`:
- Trigger ResearchOrchestrationService
- Return research status
- `stopResearch()`:
- Cancel ongoing research (set flag)
- Update global status to idle
- `getResearchStatus()`:
- Return current research status (idle/researching)

2. Create controllers in presentation layers:

- `dashboard.controller.ts` (`/dashboard`):
- `GET /state-stats`
- `POST /research-status` (body: `{ action: "start" | "stop" }`)
- `missing-casinos.controller.ts` (`/missing-casinos`):
- `GET /` (query params: state, search, limit, offset)
- `promotion-comparisons.controller.ts` (`/promotions/comparisons`):
- `GET /` (query params: casino, state, offer_type, insight, status, promotion_id, limit, offset)
- `PATCH /:comparisonId` (body: `{ action: "update" | "add" | "ignore", notes?: string }`)

3. Create DTOs in each module's presentation/dtos/:

- Request DTOs with class-validator decorators:
- `StartResearchDto`
- `UpdateComparisonDto`
- `MissingCasinoQueryDto`
- `PromotionComparisonQueryDto`
- Response DTOs:
- `StateStatsResponseDto`
- `MissingCasinoResponseDto`
- `PromotionComparisonResponseDto`
- `PaginationDto`
- Mapper functions (entity → DTO)

4. Implement global exception filter in `src/modules/shared/presentation/filters/`:

- `http-exception.filter.ts`
- Map domain exceptions to HTTP status codes
- Format errors per API spec Error schema
- Add logging with context (requestId, timestamp)

5. Apply ValidationPipe globally in `main.ts`
6. Set up CORS configuration

**Validation**:

- Start backend: `npm run start:dev`
- Test all endpoints with curl or Postman:
- GET `/dashboard/state-stats`
- POST `/dashboard/research-status` with `{ "action": "start" }`
- GET `/missing-casinos?state=NJ`
- GET `/promotions/comparisons?status=pending&limit=10`
- PATCH `/promotions/comparisons/:id` with action
- Verify response formats match API spec
- Test validation errors (invalid inputs)
- Test exception handling (not found errors)

**Testing**:

- Unit tests for DashboardService:
- MOCK service dependencies (CasinoDiscoveryService, PromotionResearchService, ResearchOrchestrationService)
- Use REAL test database for repositories (NO database mocking)
- Clean database before each test
- Integration tests for all controllers:
- Use Supertest for HTTP requests
- Use REAL test database with seeded data (NO database mocking)
- Clean database before each test
- MOCK external APIs (Perplexity, Reel Edge)
- Test successful responses (200, 201) with real database queries
- Test error responses (400, 404) with real database state
- Test validation errors
- Test offset-based pagination for comparisons (real database pagination)
- Test multi-field filtering for comparisons (real database filtering)
- Tests run sequentially to avoid concurrent request conflicts
- Each test is independent and sets up its own data

---

## Milestone 9: End-to-End Testing & Documentation (2-3 days)

**Goal**: Create comprehensive E2E tests, API documentation, and deployment guides

**Deliverables**:

- E2E test for full research workflow
- Swagger/OpenAPI documentation
- API spec validation against `api.json`
- Deployment documentation and scripts
- README with setup instructions

**Tasks**:

1. Create E2E test suite in `test/e2e/`:

- `research-workflow.e2e-spec.ts`:
- Test full research flow from start to completion
- MOCK Reel Edge API response (single fetch)
- MOCK Perplexity Search responses (casino discovery)
- MOCK Perplexity Sonar batch responses (promotions)
- Use REAL test database for all persistence (NO database mocking)
- Clean database before each test
- Verify ResearchJob created and completed (real database check)
- Verify missing casinos stored in database (real database query)
- Verify PromotionComparison records created with correct tags (real database query)
- Verify batching behavior (5-10 casinos per request through mocked API call verification)
- Test comparison status updates (real database updates)
- Verify status changes persisted (real database query)
- `api-contracts.e2e-spec.ts`:
- Test all API endpoints against `api.json` spec
- Use REAL test database (NO database mocking)
- Clean database before each test
- MOCK external APIs
- Verify request/response schemas
- Test error responses

2. Set up Swagger/OpenAPI documentation:

- Install `@nestjs/swagger`
- Configure SwaggerModule in `main.ts`
- Add decorators to controllers:
- `@ApiTags()` for grouping
- `@ApiOperation()` for endpoint descriptions
- `@ApiResponse()` for response types
- Add decorators to DTOs:
- `@ApiProperty()` for all fields
- Include examples and descriptions
- Validate against provided `api.json` specification
- Configure Swagger UI at `/api/docs`

3. Create deployment documentation:

- `docs/deployment.md`:
- Environment setup instructions
- Database migration steps (both production and test databases)
- Environment variable configuration
- Production deployment checklist (Railway, Render, Vercel)
- `docs/local-setup.md`:
- Prerequisites (Node.js, PostgreSQL, npm)
- Installation steps
- Running migrations (both dev and test databases)
- Starting development server
- Running tests (with test database setup)
- `docs/testing.md`:
- Testing guidelines (no database mocking, sequential execution)
- How to set up test database
- How to run tests
- Test data management

4. Create Docker setup (optional):

- `docker-compose.yml` for local development
- PostgreSQL service (with separate test database)
- Backend service

5. Update `README.md`:

- Project overview
- Architecture summary
- Quick start guide
- API documentation link
- Testing instructions (emphasize test database usage)
- Deployment links

6. Create setup scripts:

- `scripts/setup.sh` - Initial project setup (dev and test databases)
- `scripts/test.sh` - Run all tests sequentially
- `scripts/migrate.sh` - Run database migrations (both dev and test)
- `scripts/clean-test-db.sh` - Clean test database

**Validation**:

- Run all E2E tests: `npm run test:e2e`
- Verify all tests pass
- Verify tests run sequentially
- Verify test database is cleaned between tests
- Access Swagger UI at `http://localhost:3000/api/docs`
- Compare Swagger spec with `api.json`
- Follow deployment documentation to deploy to test environment
- Verify deployed API is accessible and functional

**Testing**:

- E2E test suite must follow all testing guidelines:
- Use REAL test database (NO database mocking)
- Clean database before each test
- Run tests sequentially (`--runInBand`)
- MOCK all external APIs (Perplexity, Reel Edge)
- Tests are context-independent
- Tests are independent of each other
- E2E test coverage:
- Full research workflow (discovery + promotion research)
- Single Reel Edge fetch verification (through mocked call tracking)
- Batch processing verification (5-10 casinos through mocked call tracking)
- Traditional comparison logic results (verified in real database)
- API contracts match specification
- Error handling and recovery (with real database state tracking)
- Status transitions (pending → updated/ignored in real database)

---

## Post-Milestone Activities

After completing all 9 milestones, perform final integration:

1. **Performance Testing**:

- Load test API endpoints
- Verify response times are acceptable
- Test with realistic data volumes
- Use real test database for load testing

2. **Security Review**:

- Review environment variable handling
- Check for exposed secrets
- Validate input sanitization
- Review CORS configuration
- Ensure test database credentials are separate from production

3. **Code Review**:

- Ensure Clean Architecture principles followed
- Check dependency flow (Presentation → Application → Domain ← Infrastructure)
- Verify error handling is comprehensive
- Review logging coverage
- Verify no database mocking in any tests

4. **Production Deployment**:

- Set up production database (Neon, Supabase, or Railway)
- Deploy backend (Railway, Render, or Vercel)
- Configure environment variables (production and test)
- Run production migrations
- Ensure test database is separate from production
- Set up monitoring (optional for POC)

5. **Documentation Review**:

- Verify README is complete
- Check Swagger docs are accurate
- Ensure deployment docs are clear
- Add troubleshooting guide
- Document test database setup clearly

---

## Success Criteria

Each milestone is considered complete when:

1. All deliverables are implemented
2. All tests pass (following testing guidelines: real database, no mocking, sequential execution)
3. Code is reviewed and follows Clean Architecture
4. Documentation is updated
5. Validation steps are successful
6. No critical bugs or technical debt introduced
7. Test database is properly configured and used

The project is considered complete when:

1. All 9 milestones are finished
2. Full research workflow executes successfully
3. All API endpoints work as specified
4. Test coverage is 70-80% for service layer
5. All tests use real test database (NO database mocking)
6. All tests run sequentially without race conditions
7. Swagger documentation matches `api.json`
8. Backend is deployed and accessible
9. E2E tests pass consistently with proper database cleanup

### To-dos

- [x] Milestone 1: Project Setup & Domain Foundation - Initialize NestJS, configure Prisma, create domain entities/enums/value objects, set up Clean Architecture structure
- [x] Milestone 2: Database Schema & Repositories - Design Prisma schema, create migrations, implement all repositories with CRUD and pagination, write repository unit tests
- [x] Milestone 3: External API Client - Reel Edge DB - Implement ReelEdgeDBClient with single-fetch caching, error handling, retry logic, and unit tests
- [x] Milestone 4: External API Clients - Perplexity - Implement PerplexitySearchClient and PerplexitySonarClient with batch processing, rate limiting, and unit tests (49 tests passing, <2s execution)
- [x] Milestone 5: Casino Discovery Service - Implement CasinoDiscoveryService with comparison logic, missing casino identification, and unit tests
- [x] Milestone 6: Promotion Research & Comparison Logic - Implement traditional comparison algorithm (better/alternative/new), PromotionResearchService with batching, filtering logic, and comprehensive unit tests
- [x] Milestone 7: Research Orchestration & Scheduling - Implement ResearchOrchestrationService for full workflow, PostgreSQL-based job scheduler, error recovery, and unit tests
- [x] Milestone 8: Dashboard & API Controllers - Implement DashboardService, all controllers with DTOs, global exception filter, and integration tests for all endpoints
- [x] Milestone 9: End-to-End Testing & Documentation - Create E2E tests for full workflow, set up Swagger/OpenAPI docs, validate against api.json, create deployment documentation