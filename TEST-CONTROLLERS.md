# Test Controllers Documentation

## Overview
Basic test controllers to verify PerplexitySearchClient and PerplexitySonarClient functionality.

## Endpoints

### 1. Search Casinos (Perplexity Search Client)

**Endpoint**: `GET http://localhost:3000/casinos/search`

**Description**: Searches for casinos in all 4 states (NJ, MI, PA, WV) using Perplexity Search API.

**Request**: No parameters needed

**Response**:
```json
{
  "NJ": {
    "casinos": [
      {
        "name": "Casino Name",
        "website": "https://casino.com",
        "regulatoryId": "LICENSE-123",
        "state": "NJ"
      }
    ],
    "citations": ["https://source1.com", "https://source2.com"]
  },
  "MI": { ... },
  "PA": { ... },
  "WV": { ... }
}
```

**Example using curl**:
```bash
curl http://localhost:3000/casinos/search
```

**Note**: This endpoint will make 4 API calls to Perplexity (one per state) and may take 15-30 seconds due to rate limiting.

---

### 2. Research Promotions (Perplexity Sonar Client)

**Endpoint**: `POST http://localhost:3000/promotions/research`

**Description**: Researches promotions for specified casinos using Perplexity Sonar API.

**Request Body**:
```json
{
  "casinos": [
    {
      "name": "BetMGM Casino",
      "state": "NJ"
    },
    {
      "name": "DraftKings Casino",
      "state": "NJ"
    }
  ]
}
```

**Response**:
```json
{
  "promotions": [
    {
      "casinoName": "BetMGM Casino",
      "offerName": "Welcome Bonus",
      "offerType": "welcome_bonus",
      "expectedDeposit": 10,
      "expectedBonus": 100,
      "termsAndConditions": "New players only",
      "wageringRequirements": "30x bonus",
      "validUntil": "2025-12-31T00:00:00.000Z"
    }
  ],
  "citations": ["https://source1.com", "https://source2.com"],
  "casinos": ["BetMGM Casino", "DraftKings Casino"]
}
```

**Example using curl**:
```bash
curl -X POST http://localhost:3000/promotions/research \
  -H "Content-Type: application/json" \
  -d '{
    "casinos": [
      {"name": "BetMGM Casino", "state": "NJ"},
      {"name": "DraftKings Casino", "state": "NJ"}
    ]
  }'
```

**Valid States**: `NJ`, `MI`, `PA`, `WV`

---

## Testing Notes

1. **Environment Setup**:
   - Ensure `PERPLEXITY_API_KEY` is set in your `.env` file
   - Default rate limit: 20 requests per minute
   - Default batch size: 7 casinos

2. **Rate Limiting**:
   - Requests are automatically rate-limited to prevent API throttling
   - Minimum 3 seconds between requests
   - If you hit 429 errors, the system will automatically wait and retry

3. **Response Times**:
   - Casino search: ~15-30 seconds (searches 4 states sequentially)
   - Promotion research: ~5-10 seconds per batch of casinos

4. **Error Handling**:
   - Network errors will be returned with appropriate HTTP status codes
   - API errors will include detailed error messages
   - Check server logs for detailed debugging information

---

## Implementation Details

### Casino Search Controller
- Location: `src/modules/casino-discovery/presentation/controllers/casino-search.controller.ts`
- Client: `PerplexitySearchClient`
- Model: `llama-3.1-sonar-small-128k-online` (Search API)

### Promotion Research Controller
- Location: `src/modules/promotion-research/presentation/controllers/promotion-research.controller.ts`
- Client: `PerplexitySonarClient`
- Model: `llama-3.1-sonar-large-128k-online` (Sonar API)

---

## Troubleshooting

### Server won't start
```bash
# Check if .env file exists and has PERPLEXITY_API_KEY
cat .env | grep PERPLEXITY_API_KEY

# Check if port 3000 is available
lsof -i :3000
```

### Rate limit errors
- Wait 60 seconds and try again
- Check `PERPLEXITY_RATE_LIMIT_RPM` in `.env`
- Default is 20 requests per minute

### No results returned
- Check API key is valid
- Check server logs for detailed error messages
- Verify internet connectivity

---

## Development Commands

```bash
# Start development server
npm run start:dev

# Build project
npm run build

# Run tests
npm test

# Check linting
npm run lint
```

