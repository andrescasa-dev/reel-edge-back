<!-- 923246c5-7b8f-49c0-bb50-a2715c3050e4 079a9ee4-65b9-4ec7-bd95-255e57d9dcc0 -->
# Backend Implementation Plan - Intelligent Casino Research Assistant

## 1. Architecture Overview

### 1.1 Clean Architecture Layers

The backend will follow Clean Architecture principles with clear separation of concerns:

**Presentation Layer (API)**

- Controllers handle HTTP requests/responses
- DTOs for request/response validation
- Exception filters for consistent error handling

**Application Layer (Business Logic)**

- Services orchestrate business operations
- Use cases encapsulate specific workflows
- Service interfaces define contracts

**Domain Layer (Core)**

- Entities represent business domain models
- Value objects for complex types
- Domain interfaces (repository contracts)
- Enums for controlled values (states, statuses, comparison types)

**Infrastructure Layer (External Dependencies)**

- Repository implementations (Prisma)
- External API clients (Perplexity, Reel Edge DB)
- Database configuration
- Job schedulers using PostgreSQL

**Dependency Flow**: Presentation → Application → Domain ← Infrastructure

### 1.2 Technology Stack

- **Runtime**: Node.js (LTS)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **AI Integration**: Perplexity SDK
- **Validation**: class-validator, class-transformer
- **Testing**: Jest (unit), Supertest (e2e)
- **Job Scheduling**: PostgreSQL-based simple job queue
- **HTTP Client**: Axios (for Reel Edge DB)

---

## 2. Module Structure

### 2.1 Core Modules

**DashboardModule**

- Provides state statistics and research status
- Manages global research orchestration (start/stop)

**CasinoDiscoveryModule**

- Discovers missing casinos using Perplexity Search API
- Compares against Reel Edge DB
- Stores missing casino records

**PromotionResearchModule**

- Researches promotions for casinos in batches
- Compares discovered vs. existing promotions
- Manages promotion comparison lifecycle

**ResearchOrchestrationModule**

- Coordinates research jobs (on-demand and scheduled)
- Manages research state and progress tracking
- Handles rate limiting and error recovery

**SharedModule**

- Common utilities, decorators, pipes
- Shared DTOs and interfaces

---

## 3. Domain Layer Design

### 3.1 Core Entities

**State Entity**

- Properties: abbreviation (NJ/MI/PA/WV), name
- Used for filtering and grouping

**Casino Entity**

- Properties: id, casinodb_id, name, state, website, regulatoryId
- Links to Reel Edge DB via casinodb_id

**Promotion Entity**

- Properties: offerName, offerType, expectedDeposit, expectedBonus, termsAndConditions, wageringRequirements, validFrom, validUntil
- Represents promotion details

**MissingCasino Entity**

- Properties: id, name, state, source, website, regulatoryId, promotionsFound, discoveredAt
- Casinos found but not in Reel Edge DB

**PromotionComparison Entity**

- Properties: id, casino, currentPromotion, discoveredPromotion, comparisonType, status, sources, createdAt, updatedAt
- Tracks comparison between existing and discovered promotions
- ComparisonType: "better", "alternative", "new"
- Status: "pending", "updated", "reviewed", "ignored"

**ResearchJob Entity**

- Properties: id, states, status, startedAt, completedAt, results, errors
- Tracks research execution history

### 3.2 Value Objects

**PromotionValue**: Encapsulates bonus comparison logic to determine which promotion is "better"

**StateSet**: Validates and manages the four supported states (NJ, MI, PA, WV)

### 3.3 Domain Enums

```typescript
enum StateAbbreviation { NJ, MI, PA, WV }
enum ResearchStatus { IDLE, RESEARCHING }
enum ComparisonType { BETTER, ALTERNATIVE, NEW }
enum ComparisonStatus { PENDING, UPDATED, REVIEWED, IGNORED }
```

---

## 4. Application Layer Design

### 4.1 DashboardService

**Responsibilities**:

- Aggregate statistics from multiple data sources
- Manage global research status (idle/researching)
- Trigger research orchestration

**Key Methods**:

- `getStateStats()`: Returns StateStats for all four states
- `startResearch()`: Initiates research for all states
- `stopResearch()`: Cancels ongoing research
- `getResearchStatus()`: Returns current research status

**Dependencies**:

- CasinoRepository
- PromotionComparisonRepository
- ResearchOrchestrationService
- ReelEdgeDBClient

### 4.2 CasinoDiscoveryService

**Responsibilities**:

- Discover licensed casinos using Perplexity Search API (cheaper, no analysis)
- Prioritize official sources (state gaming commissions, regulatory databases)
- Compare against Reel Edge DB to identify missing casinos
- Store missing casino records with metadata

**Key Methods**:

- `discoverCasinosForState(state: StateAbbreviation, cachedReelEdgeData)`: Research casinos in a specific state
- `getMissingCasinos(filters)`: Query missing casinos with pagination
- `compareCasinoLists(discovered, existing)`: Identify missing casinos
- `enrichCasinoMetadata(casino)`: Get additional details (website, regulatory ID)

**AI Prompts**:

- "Find all licensed online casinos in {state}. Prioritize information from official state gaming commission websites and regulatory databases. Provide casino names, official websites, and regulatory IDs if available."
- "Get the official website and regulatory ID for {casino name} in {state} from official gaming commission sources."

**Dependencies**:

- PerplexitySearchClient (uses Search API, not Sonar)
- Cached Reel Edge DB data
- MissingCasinoRepository

### 4.3 PromotionResearchService

**Responsibilities**:

- Research current casino promotions using Perplexity Sonar API in batches
- Batch process 5-10 casinos per request
- Include existing promotions in request for AI-assisted tagging
- Compare discovered promotions using traditional programming logic
- Filter out expired or worse promotions
- Create promotion comparison records

**Key Methods**:

- `researchPromotionsForCasinoBatch(casinos, existingPromotions)`: Discover promotions for 5-10 casinos in one request
- `comparePromotions(discovered, existing)`: Determine comparison type using traditional logic (better/alternative/new)
- `getPromotionComparisons(filters, offset, limit)`: Query comparisons with offset-based pagination
- `updateComparisonStatus(comparisonId, action)`: Handle user actions (update/add/ignore)

**AI Prompts (Batch)**:

- "For the following casinos in {state}, find current CASINO (not sports) promotional offers. Focus on deposit bonuses, no deposit bonuses, and free spins. For each casino, I'm providing their existing promotions for reference. Only return promotions that are: 1) Currently active (not expired), 2) Better than or alternative to existing offers. Do not return expired or clearly worse promotions.

Casinos and their existing promotions:

1. {Casino1 Name} - Existing: {promotion details}
2. {Casino2 Name} - Existing: {promotion details}

...

For each promotion found, indicate if it's 'better', 'alternative', or 'new' compared to existing ones."

**Comparison Logic (Traditional Programming)**:

1. **"New" promotions**: No existing promotion for casino+offer_type
2. **"Better" promotions**: 

   - Higher expected bonus value AND similar/lower deposit requirement
   - Better bonus-to-deposit ratio (bonus/deposit > existing ratio by >10%)
   - Lower wagering requirements with comparable bonus

3. **"Alternative" promotions** (default): Everything else that doesn't clearly qualify as "better"

**Dependencies**:

- PerplexitySonarClient (uses standard Sonar model with lower context)
- Cached Reel Edge DB data
- PromotionComparisonRepository
- CasinoRepository

### 4.4 ResearchOrchestrationService

**Responsibilities**:

- Orchestrate full research workflow (casino discovery → promotion research)
- Fetch and cache Reel Edge DB data once per research job
- Manage scheduled research jobs using PostgreSQL
- Handle rate limiting and error recovery
- Track research progress and results

**Key Methods**:

- `startFullResearch()`: Fetch Reel Edge data once, then research all states sequentially
- `researchState(state, cachedData)`: Research casinos and promotions for one state
- `scheduleResearch()`: Set up daily scheduled jobs (PostgreSQL-based)
- `handleResearchError()`: Implement retry logic and error logging

**Workflow**:

1. **Initialize**: Fetch ALL Reel Edge DB data once and cache for job duration
2. For each state (NJ, MI, PA, WV):

**Phase 1: Casino Discovery**

   - Discover casinos using CasinoDiscoveryService with cached data
   - Compare lists to identify missing casinos
   - Store missing casinos in database

**Phase 2: Promotion Research (Batched)**

   - Group casinos from cached data into batches of 5-10
   - For each batch:
     - Prepare batch request with existing promotion details
     - Query Perplexity Sonar with batch
     - Parse AI response (with initial tagging from AI)
     - Apply traditional comparison logic to validate/refine tags
     - Create PromotionComparison records

   - For missing casinos (if any promotions found):
     - Query promotions in batches
     - Store promotion count with missing casino record

3. Update ResearchJob (status: completed, results summary)
4. Set global research status to "idle"

**Dependencies**:

- CasinoDiscoveryService
- PromotionResearchService
- ResearchJobRepository
- ReelEdgeDBClient (called once per job)
- PostgreSQL-based job scheduler

---

## 5. Infrastructure Layer Design

### 5.1 Project Structure (NestJS Modular + Clean Architecture)

The project structure follows NestJS modular architecture while maintaining Clean Architecture principles. Each module is self-contained with its own domain, application, infrastructure, and presentation layers.

**Module Structure**:

```
src/
├── modules/
│   ├── dashboard/
│   │   ├── dashboard.module.ts
│   │   ├── domain/
│   │   │   └── entities/
│   │   ├── application/
│   │   │   └── services/
│   │   │       └── dashboard.service.ts
│   │   ├── infrastructure/
│   │   │   └── repositories/
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   └── dashboard.controller.ts
│   │       └── dtos/
│   │
│   ├── casino-discovery/
│   │   ├── casino-discovery.module.ts
│   │   ├── domain/
│   │   │   └── entities/
│   │   │       └── missing-casino.entity.ts
│   │   ├── application/
│   │   │   └── services/
│   │   │       └── casino-discovery.service.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   └── missing-casino.repository.ts
│   │   │   └── external-apis/
│   │   │       └── perplexity/
│   │   │           └── perplexity-search.client.ts
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   └── missing-casinos.controller.ts
│   │       └── dtos/
│   │
│   ├── promotion-research/
│   │   ├── promotion-research.module.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── promotion.entity.ts
│   │   │   │   └── promotion-comparison.entity.ts
│   │   │   └── value-objects/
│   │   │       └── promotion-value.vo.ts
│   │   ├── application/
│   │   │   └── services/
│   │   │       └── promotion-research.service.ts
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   │   ├── promotion-comparison.repository.ts
│   │   │   │   └── promotion.repository.ts
│   │   │   └── external-apis/
│   │   │       └── perplexity/
│   │   │           └── perplexity-sonar.client.ts
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   └── promotion-comparisons.controller.ts
│   │       └── dtos/
│   │
│   ├── research-orchestration/
│   │   ├── research-orchestration.module.ts
│   │   ├── domain/
│   │   │   └── entities/
│   │   │       └── research-job.entity.ts
│   │   ├── application/
│   │   │   └── services/
│   │   │       └── research-orchestration.service.ts
│   │   └── infrastructure/
│   │       ├── repositories/
│   │       │   └── research-job.repository.ts
│   │       └── scheduler/
│   │           └── pg-job-scheduler.ts
│   │
│   └── shared/
│       ├── shared.module.ts
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── casino.entity.ts
│       │   │   └── state.entity.ts
│       │   └── enums/
│       │       ├── state.enum.ts
│       │       ├── comparison-type.enum.ts
│       │       └── research-status.enum.ts
│       ├── infrastructure/
│       │   ├── database/
│       │   │   └── prisma/
│       │   │       └── schema.prisma
│       │   └── external-apis/
│       │       └── reel-edge/
│       │           └── reel-edge.client.ts
│       └── presentation/
│           └── filters/
│               └── http-exception.filter.ts
```

**Benefits of This Structure**:

- **NestJS Modular**: Each feature is a self-contained module
- **Clean Architecture**: Domain, Application, Infrastructure, Presentation layers within each module
- **Shared Resources**: Common entities, enums, and clients in shared module
- **Dependency Injection**: NestJS DI container manages dependencies across layers
- **Testability**: Easy to mock infrastructure and test application logic

### 5.2 Database Schema (Prisma)

**Schema Structure**:

```prisma
model Casino {
  id              String    @id @default(cuid())
  casinodb_id     Int       @unique
  name            String
  state           String
  website         String?
  regulatoryId    String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  comparisons     PromotionComparison[]
  
  @@index([state])
  @@index([name])
}

model MissingCasino {
  id              String    @id @default(cuid())
  name            String
  state           String
  source          String
  website         String?
  regulatoryId    String?
  promotionsFound Int       @default(0)
  discoveredAt    DateTime  @default(now())
  
  @@index([state])
}

model PromotionComparison {
  id                          String    @id @default(cuid())
  casinoId                    String
  
  // Current promotion (nullable for "new" comparisons)
  currentOfferName            String?
  currentOfferType            String?
  currentExpectedDeposit      Float?
  currentExpectedBonus        Float?
  currentTermsAndConditions   String?
  currentWageringRequirements String?
  
  // Discovered promotion
  discoveredOfferName            String
  discoveredOfferType            String
  discoveredExpectedDeposit      Float
  discoveredExpectedBonus        Float
  discoveredTermsAndConditions   String?
  discoveredWageringRequirements String?
  discoveredValidFrom            DateTime?
  discoveredValidUntil           DateTime?
  
  // Comparison metadata
  comparisonType              String    // better, alternative, new
  status                      String    @default("pending") // pending, updated, reviewed, ignored
  sources                     Json      // Array of citation URLs from Perplexity
  notes                       String?
  
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt
  
  casino                      Casino    @relation(fields: [casinoId], references: [id])
  
  @@index([status, comparisonType])
  @@index([casinoId])
}

model ResearchJob {
  id              String    @id @default(cuid())
  states          Json      // Array of states researched
  status          String    // running, completed, failed
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  results         Json?     // Summary results
  errors          Json?     // Error details if failed
  
  @@index([startedAt])
}

model ScheduledJob {
  id              String    @id @default(cuid())
  jobName         String    @unique
  schedule        String    // Cron expression
  lastRun         DateTime?
  nextRun         DateTime
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([isActive, nextRun])
}
```

### 5.3 Repository Pattern

**Base Repository Interface** (domain layer):

```typescript
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: object): Promise<T[]>;
  create(data: T): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

**Concrete Repositories** (infrastructure layer):

- `CasinoRepository`: CRUD operations for Casino entity
- `MissingCasinoRepository`: CRUD operations for MissingCasino entity with search
- `PromotionComparisonRepository`: Complex queries for comparisons (multi-filter, offset-based pagination)
- `ResearchJobRepository`: CRUD operations for ResearchJob entity
- `ScheduledJobRepository`: Manage scheduled jobs in PostgreSQL

**Implementation Notes**:

- Each repository uses Prisma Client
- Implements offset-based pagination for promotion comparisons
- Includes query optimization (select specific fields, eager/lazy loading)
- Handles Prisma errors and converts to domain exceptions

### 5.4 External API Clients

**PerplexitySearchClient** (for Casino Discovery)

**Responsibilities**:

- Use Perplexity Search API (cheaper, per-request pricing)
- Handle API authentication
- Implement rate limiting
- Parse and extract citations

**Key Methods**:

```typescript
async searchCasinos(state: string): Promise<CasinoSearchResult>
```

**Implementation Notes**:

- Use Search API endpoint (not Sonar)
- Prioritize official sources in prompts
- Implement exponential backoff for rate limit errors
- Log all queries and responses for debugging

**PerplexitySonarClient** (for Promotion Research)

**Responsibilities**:

- Use standard Sonar model with lower context (POC optimization)
- Batch process 5-10 casinos per request
- Handle API authentication
- Implement rate limiting
- Parse batch responses and extract citations

**Key Methods**:

```typescript
async queryPromotionsBatch(casinos: Casino[], existingPromotions: Map<string, Promotion[]>): Promise<BatchPromotionResult>
```

**Implementation Notes**:

- Use standard Sonar model (not Sonar Pro) for cost optimization
- Configure with lower max_tokens for POC
- Batch 5-10 casinos per request
- Include existing promotions in prompt for comparison context
- Implement exponential backoff for rate limit errors
- Extract and structure sources/citations from responses

**ReelEdgeDBClient**

**Responsibilities**:

- Fetch ALL casinos and promotions from Reel Edge DB in single request
- Cache data for entire research job duration (single source of truth)
- Handle external API errors gracefully

**Key Methods**:

```typescript
async fetchAllActiveData(): Promise<ReelEdgeData>
// Returns: { casinos: Casino[], promotions: Promotion[] }
// Called ONCE per research job
```

**API Integration**:

- Base URL: `https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0`
- Endpoint: `/activeSUB`
- Response format: Array of casino+promotion objects

**Implementation Notes**:

- Use Axios with retry logic
- Fetch ALL data in a single request at research job start
- Cache in-memory for the duration of the research job
- Transform response to match internal entities
- Handle network errors and timeouts
- No per-state or per-casino filtering - fetch everything once
- Data is passed to services, not refetched

---

## 6. Presentation Layer Design

### 6.1 Controllers and Endpoints

**DashboardController** (`/dashboard`)

- `GET /state-stats`: Returns StateStats for all states
- `POST /research-status`: Start/stop research (body: { action: "start" | "stop" })

**MissingCasinosController** (`/missing-casinos`)

- `GET /`: List missing casinos (query params: state, search, limit, offset)

**PromotionComparisonsController** (`/promotions/comparisons`)

- `GET /`: List promotion comparisons with offset-based pagination (query params: casino, state, offer_type, insight, status, promotion_id, limit, offset)
- `PATCH /:comparisonId`: Update comparison status (body: { action: "update" | "add" | "ignore", notes?: string })

### 6.2 DTOs (Data Transfer Objects)

**Request DTOs**:

- `StartResearchDto`: Validates action field (start/stop)
- `UpdateComparisonDto`: Validates action and notes
- `MissingCasinoQueryDto`: Validates query parameters with proper types
- `PromotionComparisonQueryDto`: Validates complex query filters with offset-based pagination

**Response DTOs**:

- `StateStatsResponseDto`: Matches API spec StateStats schema
- `MissingCasinoResponseDto`: Matches API spec MissingCasino schema
- `PromotionComparisonResponseDto`: Matches API spec PromotionComparison schema
- `PaginationDto`: Reusable offset-based pagination metadata

**Implementation Notes**:

- Use `class-validator` decorators for validation
- Use `class-transformer` for serialization
- Create mapper functions to transform entities to DTOs
- Support offset-based pagination for promotion comparisons

### 6.3 Exception Handling

**Global Exception Filter**:

- Catch all exceptions and format as API spec Error schema
- Map domain exceptions to HTTP status codes
- Log errors with context (request ID, user, timestamp)

**Custom Exceptions**:

- `CasinoNotFoundException`
- `ComparisonNotFoundException`
- `InvalidStateException`
- `PerplexityAPIException`
- `ReelEdgeAPIException`

---

## 7. Research Workflow Implementation

### 7.1 Full Research Flow

**Trigger**: User clicks "Start Research" or scheduled job runs

**Process**:

1. Create ResearchJob record (status: running)
2. Set global research status to "researching"
3. **Fetch Reel Edge DB data ONCE** - cache for entire job duration
4. For each state (NJ, MI, PA, WV):

**Phase 1: Casino Discovery**

   - Query Perplexity Search API: "Find licensed online casinos in {state}. Prioritize official gaming commission sources."
   - Parse AI response to extract casino names and details
   - Use cached Reel Edge data to compare
   - Identify and store missing casinos

**Phase 2: Promotion Research (Batched)**

   - Group casinos (from cached Reel Edge data) into batches of 5-10
   - For each batch:
     - Prepare batch request with existing promotions from cache
     - Query Perplexity Sonar: Batch request for 5-10 casinos with existing promotions for context
     - Parse AI response (may include initial tagging suggestions)
     - Apply traditional comparison logic to determine final tags
     - Filter out expired or worse promotions
     - Create PromotionComparison records

   - For missing casinos:
     - Query promotions (can also batch if multiple missing casinos)
     - Store promotion count with missing casino record

5. Update ResearchJob (status: completed, results summary)
6. Set global research status to "idle"

### 7.2 Comparison Logic (Traditional Programming - No AI)

**Determining "Better" Promotions**:

Use traditional programming logic (no AI assistance for cost optimization):

1. Calculate bonus-to-deposit ratio: `bonusRatio = expectedBonus / expectedDeposit`
2. Compare ratios: `discovered.bonusRatio vs existing.bonusRatio`
3. Consider wagering requirements as a factor

**Rules**:

- **"Better"**: 
  - Bonus ratio is >10% higher than existing
  - OR: Same bonus, lower deposit requirement
  - OR: Same bonus and deposit, but significantly lower wagering requirements (>20% lower)

- **"New"**: 
  - No existing promotion for that casino + offer type combination

- **"Alternative"** (default): 
  - Everything else that doesn't clearly qualify as "better" or "new"
  - When in doubt, tag as "alternative"

**Implementation**:

```typescript
function determineComparisonType(discovered: Promotion, existing: Promotion | null): ComparisonType {
  if (!existing) return ComparisonType.NEW;
  
  const discoveredRatio = discovered.expectedBonus / discovered.expectedDeposit;
  const existingRatio = existing.expectedBonus / existing.expectedDeposit;
  
  // Better: >10% better ratio
  if (discoveredRatio > existingRatio * 1.1) {
    return ComparisonType.BETTER;
  }
  
  // Better: Same bonus, lower deposit
  if (discovered.expectedBonus === existing.expectedBonus && 
      discovered.expectedDeposit < existing.expectedDeposit) {
    return ComparisonType.BETTER;
  }
  
  // Better: Similar value, significantly lower wagering
  if (Math.abs(discoveredRatio - existingRatio) < 0.1 && 
      discovered.wageringRequirements < existing.wageringRequirements * 0.8) {
    return ComparisonType.BETTER;
  }
  
  // Default to alternative
  return ComparisonType.ALTERNATIVE;
}
```

**Filtering Rules**:

- Ignore expired promotions (check validUntil date)
- Ignore promotions with significantly worse ratios (>30% worse) 
- When uncertain, keep as "alternative" rather than filtering out

### 7.3 Rate Limiting Strategy

**Perplexity API Limits**:

- Track requests per minute
- Implement queue with throttling
- Add delays between batch requests (3-5 seconds)
- Handle 429 errors with exponential backoff

**Batch Processing**:

- Process 5-10 casinos per Sonar request
- Process one state at a time
- Sequential batch processing within each state

---

## 8. Configuration Management

### 8.1 Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/casino_research

# Perplexity API
PERPLEXITY_API_KEY=pplx-xxxxx

# Reel Edge DB
REEL_EDGE_API_URL=https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0

# Research Settings
RESEARCH_SCHEDULE_CRON=0 0 * * * # Daily at midnight
PERPLEXITY_RATE_LIMIT_RPM=20 # Requests per minute
PROMOTION_BATCH_SIZE=7 # Casinos per batch (5-10)

# NextAuth (for session validation)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3001
```

### 8.2 Configuration Module

Use NestJS ConfigModule with validation:

- Define ConfigService with typed getters
- Validate environment variables on startup
- Use .env files for local development
- Support .env.development, .env.production

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Focus**: Business logic in services and domain models

**Tests to Write**:

- DashboardService: State stats aggregation
- CasinoDiscoveryService: Casino comparison logic
- PromotionResearchService: Promotion comparison logic with traditional algorithm
- PromotionValue: Bonus value comparison
- Comparison logic: Test all scenarios (better/alternative/new)
- Repositories: CRUD operations (mocked Prisma)

**Approach**:

- Mock external dependencies (Prisma, Perplexity, Reel Edge)
- Use Jest with dependency injection
- Aim for 70-80% coverage on service layer

### 9.2 Integration Tests

**Focus**: API endpoints with real database (test DB)

**Tests to Write**:

- GET /dashboard/state-stats: Returns correct structure
- POST /dashboard/research-status: Triggers research
- GET /missing-casinos: Filters and pagination work
- GET /promotions/comparisons: Complex filtering with offset-based pagination
- PATCH /promotions/comparisons/:id: Status updates

**Approach**:

- Use Supertest for HTTP requests
- Use test database with Prisma migrations
- Seed test data before each test suite
- Mock external APIs (Perplexity, Reel Edge)

### 9.3 E2E Tests

**Focus**: Full research workflow with batching

**Test Scenario**:

1. Start research
2. Mock Reel Edge API response (single fetch)
3. Mock Perplexity Search responses for casino discovery
4. Mock Perplexity Sonar batch responses for promotions
5. Verify missing casinos are created
6. Verify promotion comparisons are created with correct tags
7. Verify batching behavior (5-10 casinos per request)
8. Update comparison status
9. Verify status change persisted

**Approach**:

- Use test database
- Mock external APIs with realistic batch responses
- Test complete user workflows
- Verify Reel Edge is only called once

### 9.4 Test Organization

```
src/
  modules/
    dashboard/
      __tests__/
        dashboard.service.spec.ts
        dashboard.controller.spec.ts
    promotion-research/
      __tests__/
        comparison-logic.spec.ts
  __tests__/
    e2e/
      research-workflow.e2e-spec.ts
      api-contracts.e2e-spec.ts
```

---

## 10. Project Structure

```
casino-research-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── casino-discovery/
│   │   ├── promotion-research/
│   │   ├── research-orchestration/
│   │   └── shared/
│   │
│   ├── config/
│   │   ├── configuration.ts
│   │   └── validation.schema.ts
│   │
│   └── common/
│       ├── decorators/
│       ├── guards/
│       ├── interceptors/
│       └── utils/
│
├── test/
│   └── e2e/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 11. Key Implementation Decisions

### 11.1 Clean Architecture Enforcement

**Dependency Rules**:

- Domain layer has ZERO dependencies on other layers
- Application layer depends only on Domain
- Infrastructure and Presentation depend on Application and Domain
- Use dependency injection to invert infrastructure dependencies

**Benefits**:

- Testable: Mock infrastructure easily
- Maintainable: Clear boundaries and responsibilities
- Flexible: Can swap databases, APIs, or frameworks

### 11.2 Perplexity Integration Strategy

**Two-Client Approach**:

- **Search API** for casino discovery (cheaper, no analysis)
- **Sonar Standard** for promotion research (batch processing, lower context)

**Structured Prompts**:

- Use consistent prompt templates
- Request structured output when possible
- Always ask for sources/citations
- Be specific about "casino" (not sports) promotions
- Prioritize official sources for casino discovery
- Include existing promotions in batch requests for context

**Response Parsing**:

- Extract structured data from AI responses
- Parse citations into array of URLs
- Handle incomplete or unexpected responses gracefully
- Log raw AI responses for debugging

**Error Handling**:

- Retry on transient failures (network, timeout)
- Skip casino batch on repeated failures (don't block entire research)
- Log failures for manual review

### 11.3 Data Consistency Strategy

**Single Source of Truth**:

- Reel Edge DB is fetched ONCE per research job
- Data is cached in-memory for the job duration
- All services use the same cached snapshot
- Never modify Reel Edge DB from this system

**Comparison Lifecycle**:

- Comparisons start as "pending"
- User actions move to "updated", "reviewed", or "ignored"
- Status changes are atomic (database transaction)

**Research Job Idempotency**:

- Multiple research runs for same casino update existing comparisons
- Use upsert logic: create if new, update if exists
- Track when comparisons were last updated

### 11.4 Performance Considerations

**Pagination**:

- Implement offset-based pagination for promotion comparisons
- Default limits: 10 for comparisons, 50 for missing casinos
- Include total count for UI

**Caching**:

- Cache Reel Edge DB data for entire research job duration
- Cache state stats (1 minute)
- Don't cache research results (always fresh)

**Database Optimization**:

- Index frequently queried fields (state, status, comparisonType)
- Use partial indexes for status-specific queries
- Use EXPLAIN ANALYZE to optimize slow queries

**Background Processing**:

- Research runs in background (doesn't block API)
- Use PostgreSQL-based simple job scheduler
- Process in batches (5-10 casinos per request)

---

## 12. Job Scheduling with PostgreSQL

### 12.1 Simple PostgreSQL Job Scheduler

**Implementation**:

- Create `ScheduledJob` model in Prisma
- Store job schedule, last run, next run times
- Use NestJS `@Cron` decorator to check for due jobs
- Execute jobs that are due
- Update last run and calculate next run time

**Benefits**:

- No additional infrastructure (Redis, Bull)
- Simple and sufficient for POC
- Easy to understand and maintain

**Example**:

```typescript
@Cron('*/5 * * * *') // Check every 5 minutes
async checkScheduledJobs() {
  const dueJobs = await this.scheduledJobRepository.findDueJobs();
  for (const job of dueJobs) {
    await this.executeJob(job);
    await this.scheduledJobRepository.updateLastRun(job.id);
  }
}
```

---

## 13. Deployment Considerations

### 13.1 Environment Setup

**Development**:

- Local PostgreSQL database
- Docker Compose for database
- Hot reload with NestJS

**Production**:

- PostgreSQL: Neon, Supabase, or Railway
- Backend: Railway, Render, or Vercel (serverless)
- Environment variables via platform secrets

### 13.2 Database Migrations

**Strategy**:

- Use Prisma Migrate for schema changes
- Version migrations in git
- Run migrations automatically on deployment
- Keep migration rollback scripts

**Process**:

```bash
npm run prisma:migrate:dev    # Development
npm run prisma:migrate:prod   # Production
```

### 13.3 Monitoring and Logging

**Logging**:

- Use NestJS built-in Logger
- Log levels: error, warn, info, debug
- Include context (module, method, requestId)
- Log all Perplexity queries and responses
- Log Reel Edge fetch at job start

**Monitoring** (optional for POC):

- Track research job success/failure rates
- Monitor API response times
- Alert on high error rates

---

## 14. API Documentation

**Use Swagger/OpenAPI**:

- Auto-generate from NestJS decorators
- Match provided api.json specification
- Include example requests/responses
- Document authentication requirements

**Setup**:

- Install @nestjs/swagger
- Configure SwaggerModule in main.ts
- Decorate controllers with @ApiTags, @ApiOperation
- Decorate DTOs with @ApiProperty

**Access**: Available at `/api/docs` in development

---

## 15. Authentication Integration

**Strategy**:

- Frontend handles authentication via NextAuth
- Backend validates session cookie
- No user management in backend (stateless)

**Implementation**:

- Create AuthGuard to validate NextAuth session token
- Apply guard globally or per controller
- For POC, can start without auth and add later

---

## 16. Limitations and Trade-offs

### 16.1 AI Research Limitations

**Challenges**:

- Perplexity may not find all promotions (depends on website structure)
- Promotions may be behind login walls (not accessible)
- Comparison logic is simple heuristic (not perfect)
- AI responses can be inconsistent

**Mitigations**:

- Use clear, specific prompts
- Log all AI interactions for review
- Allow manual overrides (comparison status)
- Default to "alternative" when uncertain
- Document known limitations

### 16.2 Rate Limiting

**Constraint**: Perplexity API has rate limits

**Impact**: Research may take 10-15 minutes for all states (with batching)

**Approach**: Batch processing (5-10 casinos) with delays between batches

### 16.3 Testing Scope

**Good Enough Testing**:

- Focus on critical paths (research workflow, comparison logic)
- Mock external APIs (don't hit real Perplexity in tests)
- Integration tests for API contracts
- Test traditional comparison algorithm thoroughly
- Skip testing trivial DTOs and simple getters

**What to Skip**:

- 100% code coverage (aim for 70-80%)
- Testing framework internals (trust NestJS)
- Exhaustive edge case testing

---

## 17. Future Enhancements (Not in POC)

- **Real-time Updates**: WebSockets for research progress
- **Multi-user Support**: User-specific research jobs and comparisons
- **Promotion Tracking**: Historical promotion data and trends
- **Advanced Caching**: Redis for distributed caching
- **Admin Dashboard**: Manage research jobs, view logs
- **Webhook Integration**: Notify external systems of new promotions
- **ML-based Comparison**: Train model on user feedback to improve tagging
- **Parallel State Processing**: Research multiple states simultaneously

---

## Summary

This backend implementation plan provides a comprehensive roadmap for building the Intelligent Casino Research Assistant using Clean Architecture principles, optimized for POC with cost-effective AI usage.

**Key Optimizations**:

1. **Single Reel Edge Fetch**: Fetch once per job, cache for consistency
2. **Dual Perplexity Strategy**: Search API for discovery, Standard Sonar for promotions
3. **Batch Processing**: 5-10 casinos per request to reduce API calls
4. **Traditional Comparison Logic**: No AI for comparison to keep costs low
5. **PostgreSQL Job Scheduling**: Simple, no additional infrastructure
6. **Offset-based Pagination**: Standard pagination for promotion comparisons

**Architecture Benefits**:

1. **Separation of Concerns**: Clear layering (Domain, Application, Infrastructure, Presentation)
2. **Testability**: Dependency injection and mocked external services
3. **Maintainability**: Well-organized modules and clear responsibilities
4. **Flexibility**: Easy to swap databases, AI providers, or add features
5. **Cost-Effective**: Optimized for POC budget with smart batching and traditional logic

The plan focuses on delivering core requirements (casino discovery, promotion research, comparison) while maintaining code quality, architectural best practices, and cost optimization for a proof-of-concept.

### To-dos

- [ ] Initialize NestJS project with TypeScript, configure Prisma with PostgreSQL, set up environment variables and configuration module
- [ ] Create domain layer entities (Casino, MissingCasino, Promotion, PromotionComparison, ResearchJob, ScheduledJob), enums, value objects, and repository interfaces
- [ ] Design and implement Prisma schema with all entities, relationships, indexes, and ScheduledJob model; create initial migration
- [ ] Implement repository pattern for all entities with CRUD operations, filtering, and offset-based pagination for promotion comparisons
- [ ] Implement ReelEdgeDBClient to fetch ALL casinos and promotions in single request with job-duration caching
- [ ] Implement PerplexitySearchClient (for casino discovery) and PerplexitySonarClient (standard Sonar with batch processing for 5-10 casinos) with rate limiting and error handling
- [ ] Implement CasinoDiscoveryService using Search API with official source prioritization, comparison against cached Reel Edge data, and missing casino storage
- [ ] Implement traditional comparison logic (no AI) to determine better/alternative/new promotions based on bonus ratios and wagering requirements
- [ ] Implement PromotionResearchService with batch processing (5-10 casinos), traditional comparison logic, filtering expired/worse promotions, and offset-based pagination
- [ ] Implement PostgreSQL-based simple job scheduler using ScheduledJob model and NestJS @Cron decorator
- [ ] Implement ResearchOrchestrationService to fetch Reel Edge data once per job, coordinate full research workflow with batching, handle scheduling via PostgreSQL, and manage research state
- [ ] Implement DashboardService to aggregate statistics from cached data and manage research status
- [ ] Implement all controllers (Dashboard, MissingCasinos with pagination, PromotionComparisons with offset-based pagination) with DTOs and validation
- [ ] Implement global exception filter and custom domain exceptions
- [ ] Write unit tests for services (with mocked dependencies), traditional comparison logic algorithm, and repositories
- [ ] Write integration tests for API endpoints including offset-based pagination, with mocked external APIs
- [ ] Write E2E test for full research workflow including single Reel Edge fetch, batch processing, and traditional comparison logic
- [ ] Set up Swagger/OpenAPI documentation matching the provided api.json specification
- [ ] Create deployment documentation, setup scripts, and environment configuration examples