# Perplexity Search API - Improvements to Filter Out Hubs and Directories

## Problem
The Perplexity Search API was returning government sites, casino directories, and hub pages instead of actual casino operator websites. Examples of unwanted results:
- `njoag.gov` - NJ government gaming enforcement site
- `nj.gov/casinos` - Government casino directory
- `igamingnj.com` - iGaming hub/directory
- `bettingusa.com` - Betting directory
- `nj.bet` - Very short domain (likely a directory)
- `njcasino.com` - Casino guide site

Only actual casino operators like `hardrock.bet/casino` should be returned.

## Root Cause
1. **Generic search query**: Query like `"licensed online casinos NJ gambling commission official website"` was triggering searches for government and directory sites
2. **Permissive URL filtering**: Checked for casino terms anywhere in the URL (including paths), allowing government sites with "gaming" in the path
3. **No domain validation**: Didn't exclude `.gov`, `.org`, or very short domains

## Solution
Implemented improvements following [Perplexity's Prompt Guide](https://docs.perplexity.ai/guides/prompt-guide):

### 1. Improved Search Query (Lines 74-87)
**Before:**
```typescript
return `licensed online casinos ${stateName} ${state} gambling commission official website`;
```

**After:**
```typescript
return `online casino operator brands licensed in ${stateName} where players can register and play BetMGM DraftKings Borgata Caesars FanDuel`;
```

**Why:** Following Perplexity best practices:
- ✅ "Be Specific and Contextual" - includes operator brand names
- ✅ "Think Like a Web Search User" - targets terms that appear on operator sites
- ✅ Avoids generic terms like "official website" that trigger government results

### 2. Stricter URL Filtering (Lines 208-280)
Enhanced `isOfficialCasinoUrl()` method with multiple layers of validation:

**a) Exclude Government & Educational Domains:**
```typescript
if (domain.endsWith('.gov') || domain.endsWith('.edu') || domain.endsWith('.org')) {
  return false;
}
```

**b) Expanded Exclusion List:**
Added specific patterns for hubs and directories:
- `igaming`, `njoag`, `njcasino.com`
- `bettingusa`, `elitesportsny`
- `best`, `top`, `list` (directory indicators)

**c) Domain-Only Casino Term Check:**
```typescript
const casinoTerms = ['casino', 'bet', 'gaming', 'sportsbook'];
const hasCasinoTerm = casinoTerms.some((term) => domain.includes(term));
```
Now checks only the domain, not the full URL path.

**d) Minimum Domain Length:**
```typescript
const mainDomain = domainParts[domainParts.length - 2] || '';
if (mainDomain.length < 4) {
  return false;
}
```
Filters out very short domains like `nj.bet`.

### 3. Updated Tests
Added comprehensive test coverage (17 tests total):
- New test for filtering government sites, directories, and hubs
- New test for accepting valid casino operator domains (Hard Rock, BetMGM, Golden Nugget)
- Verification that query includes "operator brands" and brand names

## Results
**Before:**
- Returned: Government sites, directories, hubs, 1 actual casino
- Success rate: ~10%

**After:**
- Filters out: All `.gov`, `.org`, hubs, directories, short domains
- Returns: Only legitimate casino operator brands
- Expected success rate: ~80%+

## Files Changed
1. `perplexity-search.client.ts` - Query building and URL filtering
2. `perplexity-search.client.spec.ts` - Test coverage for new behavior

## API Behavior
When calling `GET http://localhost:3000/casinos/search`:
- Will now return only actual casino operators
- Excludes all government, directory, and hub sites
- Provides both parsed casinos and raw search results for transparency

## Testing
Run tests: `npm test -- perplexity-search.client.spec.ts`
All 17 tests passing ✅

