# Testing the Improved Casino Search

## Changes Summary
The Perplexity Search API integration has been improved to filter out hubs, directories, and government sites, returning only actual casino operators.

## What Was Fixed
Following [Perplexity's Prompt Guide](https://docs.perplexity.ai/guides/prompt-guide):

1. **Better Search Query** - Now targets "casino operator brands" specifically
2. **Strict Domain Filtering** - Excludes `.gov`, `.org`, hubs, and directories
3. **Minimum Domain Length** - Filters out very short domains like `nj.bet`
4. **Domain-Only Checks** - Only checks casino terms in the domain, not the URL path

## Testing

### Unit Tests
All tests passing:
```bash
npm test -- perplexity-search.client.spec.ts
# 17 tests passing ✅
```

### Manual API Testing

#### 1. Start the server:
```bash
npm run start:dev
```

#### 2. Test the endpoint:
```bash
curl http://localhost:3000/casinos/search | jq
```

### Expected Results

**Should Now Return:**
- ✅ Actual casino operator brands (BetMGM, DraftKings, Hard Rock, etc.)
- ✅ Domains with `casino`, `bet`, `gaming`, `sportsbook` in the domain name
- ✅ Minimum 4-character domain names
- ✅ Only `.com`, `.net`, `.bet`, etc. (commercial domains)

**Should Filter Out:**
- ❌ Government sites (`.gov` domains)
- ❌ Educational sites (`.edu` domains)
- ❌ Directory sites (`.org` domains like `casino.org`)
- ❌ Hub sites (`igamingnj.com`, `bettingusa.com`, `njcasino.com`)
- ❌ Review sites (contains `review`, `affiliate`, `bonus`, `guide`, `compare`)
- ❌ Very short domains (`nj.bet` - less than 4 chars)

### Validation

Compare the results to your previous output. You should now see:
- Fewer total results
- No `.gov` or `.org` URLs
- No hub/directory sites
- Only legitimate casino operator websites

### Example Valid Results
```json
{
  "name": "Hard Rock Bet",
  "website": "https://www.hardrock.bet/casino/new-jersey/",
  "state": "NJ"
}
```

### Example Filtered Results (Won't Appear)
```json
// These will NO LONGER appear:
{
  "name": "Internet",
  "website": "https://www.njoag.gov/...",  // ❌ .gov domain
  "state": "NJ"
},
{
  "name": "NJ",
  "website": "https://www.nj.gov/casinos/",  // ❌ .gov domain
  "state": "NJ"
},
{
  "name": "Top NJ Online",
  "website": "https://igamingnj.com/casinos/",  // ❌ hub/directory
  "state": "NJ"
}
```

## Full Test Suite
To run all tests:
```bash
npm test
# 125 tests passing ✅
```

## Documentation
See `PERPLEXITY-SEARCH-IMPROVEMENTS.md` for detailed technical documentation.

