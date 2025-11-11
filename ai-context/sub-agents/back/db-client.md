# Database Selection: PostgreSQL

## Decision: PostgreSQL

PostgreSQL is the optimal database for the Casino Research Assistant backend.

## Why PostgreSQL Fits This Project

### 1. **Relational Data Model**

The project has clear entity relationships:

```
States (1) → (N) Casinos → (N) Promotions → (N) Comparisons
```

PostgreSQL excels at:

- Maintaining referential integrity (casino IDs must be valid)
- Enforcing foreign key constraints (prevent orphaned comparisons)
- Querying across related entities with JOINs

### 2. **Complex Query Requirements**

The API contract requires multi-dimensional filtering:

- `/promotions/comparisons?state=NJ&casino=BetMGM&offer_type=Deposit&insight=better&status=pending`

PostgreSQL provides:

- ✅ Efficient indexed queries across multiple columns
- ✅ Built-in full-text search for casino name searches
- ✅ Advanced WHERE clauses with compound conditions
- ✅ Performant pagination with OFFSET/LIMIT

NoSQL databases would require multiple queries or complex denormalization.

### 3. **Data Integrity Matters**

**Critical requirement**: Comparison status updates (pending → updated → reviewed) must be atomic.

PostgreSQL guarantees:

- **ACID compliance**: No race conditions when multiple users review comparisons
- **Transaction support**: Status updates are all-or-nothing
- **Constraint validation**: Invalid statuses are rejected at database level

### 4. **Structured Data with Flexibility**

Core data is structured (casino names, bonus amounts, states), but we need flexibility for:

- AI citations (variable number of sources)
- Research logs (unstructured log messages)
- Raw AI responses (for debugging)

PostgreSQL provides:

- **JSON/JSONB columns**: Store flexible data without schema changes
- **Type safety**: Structured fields remain strongly typed
- **JSON querying**: Can filter/search within JSON fields if needed

### 5. **Time-Series Analytics**

The system tracks research history:

- When was each casino last researched?
- How many promotions were discovered over time?
- Research job performance metrics

PostgreSQL excels at:

- Timestamp indexing for efficient date range queries
- Aggregation functions (COUNT, AVG, SUM) for analytics
- Window functions for trending analysis

### 6. **Developer Experience**

With TypeScript/Prisma:

- **Type-safe queries**: Auto-generated types prevent runtime errors
- **Migration management**: Schema changes are versioned and reproducible
- **Excellent tooling**: Prisma Studio for data inspection, pgAdmin for admin

### 7. **Production-Ready with Minimal Overhead**

Deployment options:

- **Neon.tech**: Free tier, serverless PostgreSQL, auto-scaling
- **Supabase**: Free tier, includes auth, real-time features
- **Railway**: Simple deployment, built-in PostgreSQL

All provide:

- Connection pooling (handle concurrent requests)
- Automated backups
- SSL connections
- Zero configuration

## What We're NOT Using (and Why)

### MongoDB

- ❌ Weak JOIN support makes promotion comparisons inefficient
- ❌ Complex filtering (state + casino + type + status) requires multiple queries
- ❌ No built-in transaction guarantees for status updates

### SQLite

- ❌ Poor concurrent write performance (blocks entire database)
- ❌ No network access (can't run scheduled jobs on separate server)
- ❌ Not suitable for production deployment

### DynamoDB

- ❌ Requires extensive index planning upfront for every query pattern
- ❌ More expensive for POC
- ❌ Over-engineered for project scale

## Schema Highlights

```prisma
// Clean relationships
model Casino {
  id              String   @id @default(cuid())
  casinodb_id     Int      @unique // Links to Reel Edge DB
  name            String
  state           String

  comparisons     PromotionComparison[] // 1:N relationship
  @@index([state, name]) // Efficient filtering
}

model PromotionComparison {
  id                    String   @id
  casinoId              String

  // Structured promotion data
  discoveredOfferName   String
  discoveredBonus       Float

  // Flexible AI data
  sources               Json     // Array of citation URLs

  comparisonType        String   // "better", "alternative", "new"
  status                String   // "pending", "updated", "reviewed"

  casino                Casino   @relation(fields: [casinoId], references: [id])

  @@index([status, comparisonType]) // Fast API queries
}
```

## Performance Considerations

**Expected scale** (POC):

- ~50 casinos across 4 states
- ~200 active promotions
- ~1,000 comparisons/month
- Daily research jobs (4 states)

**PostgreSQL handles this effortlessly**:

- Single database server sufficient
- Query response times < 50ms
- No need for sharding or complex optimization

## Conclusion

PostgreSQL is the right choice because it:

1. **Matches the data model** (relational entities with clear relationships)
2. **Supports complex queries** required by the API contract
3. **Ensures data integrity** with ACID guarantees
4. **Balances structure and flexibility** (typed fields + JSON columns)
5. **Provides excellent DX** with Prisma ORM
6. **Scales appropriately** for POC → production evolution

**Simple trade-off**: Slightly more setup (5 minutes) vs. significantly better maintainability, querying, and data integrity.
