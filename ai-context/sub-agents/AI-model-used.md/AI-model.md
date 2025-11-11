# AI Model Selection Decision

## Executive Summary

**Selected Model**: Perplexity API

**Decision**: The Intelligent Research Assistant will use **Perplexity API** as its sole AI model for discovering casinos and researching promotional offers across NJ, MI, PA, and WV.

This document explains the rationale behind this selection, the alternative considered, and the requirements that guided the decision.

---

## Why Perplexity API?

Perplexity API was selected because it is specifically designed for real-time web research and data extraction—the core requirements of this project.

### Key Advantages

**1. Built for Web Research**

- Perplexity is an AI-native search and research engine built specifically to query the web and return clean, structured data
- Every query automatically searches the live web, ensuring we get current promotional data, not outdated training data
- This is exactly what we need: a tool designed for information retrieval, not just conversation

**2. Real-Time Data Access**

- Automatically retrieves today's promotional offers from casino websites
- Accesses official sources like state gaming commission websites
- Provides current information, not historical data from training

**3. Automatic Source Citations**

- Every response includes source URLs for verification
- Enables transparency and fact-checking
- Helps identify where information came from (critical for regulatory compliance)

**4. Structured, Fact-Focused Responses**

- Returns concise, factual summaries ideal for data extraction
- Designed to provide parseable data suitable for JSON output
- Less conversational overhead means more efficient data processing

**5. Search-First Architecture**

- Optimized for information retrieval rather than general conversation
- Faster response times for research queries
- Lower cost per query compared to general-purpose models

---

## Alternative Considered: GPT-4o

**GPT-4o with web search** was evaluated as the most plausible alternative.

### Why GPT-4o Was Considered

- Strong general-purpose AI capabilities
- Web search feature available when enabled
- Excellent at complex reasoning and nuanced comparisons
- Well-established API with good documentation

### Why GPT-4o Was Not Selected

**1. Different Primary Purpose**

- GPT-4o is a general-purpose conversational AI assistant
- Web search is an optional feature, not its core strength
- More conversational and less optimized for structured data extraction

**2. Knowledge Limitations**

- Primary knowledge cutoff (October 2023) means it relies on training data unless web search is explicitly enabled
- Web search citations are only provided when using the web feature, not for internal knowledge
- Less automatic in ensuring real-time data

**3. Response Style**

- More conversational and narrative-focused
- Longer responses with more explanation
- Less optimized for quick, structured data extraction

**4. Cost and Efficiency**

- Generally more expensive per query
- Designed for broader use cases, not specifically for research
- May include unnecessary conversational elements that add cost

### Comparison Summary

| Aspect             | Perplexity API                        | GPT-4o (with web search)                          |
| ------------------ | ------------------------------------- | ------------------------------------------------- |
| **Primary Design** | AI-powered search engine              | Conversational AI assistant                       |
| **Web Access**     | Automatic, built-in for every query   | Optional feature that must be enabled             |
| **Data Freshness** | Real-time web search by default       | Relies on training data unless web search enabled |
| **Citations**      | Automatic inline citations            | Only when web search is used                      |
| **Response Style** | Concise, factual, summary-oriented    | Conversational, narrative-focused                 |
| **Optimization**   | Information retrieval                 | General-purpose conversation                      |
| **Best For**       | Research, fact-checking, current data | Complex reasoning, creative tasks, conversation   |

---

## Requirements Analysis

The following project requirements were used to evaluate and select the AI model:

### Critical Requirements

**1. Real-Time Web Research**

- **Requirement**: Must gather current casino and promotion data from websites
- **Perplexity**: ✓ Built-in real-time web access for every query
- **GPT-4o**: ⚠️ Requires explicit web search activation

**2. Data Extraction from Casino Websites**

- **Requirement**: Must extract structured information (casino names, licenses, promotions) from various website formats
- **Perplexity**: ✓ Designed for structured data extraction with clean, parseable responses
- **GPT-4o**: ⚠️ Can do this but with more conversational overhead

**3. Promotion Comparison**

- **Requirement**: Must identify when discovered promotions are better than existing ones in the Reel Edge database
- **Perplexity**: ✓ Can compare offers and determine which provides better value
- **GPT-4o**: ✓ Strong at complex reasoning and comparisons

**4. Structured Output**

- **Requirement**: Must output data in JSON format for the UI
- **Perplexity**: ✓ Fact-focused responses easily structured into JSON
- **GPT-4o**: ✓ Can generate structured output but may require more prompt engineering

**5. Cost Efficiency**

- **Requirement**: Must fit within project budget for daily scheduled execution
- **Perplexity**: ✓ Optimized pricing for research queries
- **GPT-4o**: ⚠️ Generally higher cost per query

### Decision Criteria

Based on the requirements analysis:

| Requirement                | Perplexity  | GPT-4o           | Winner         |
| -------------------------- | ----------- | ---------------- | -------------- |
| Real-time web access       | ✓ Built-in  | ⚠️ Optional      | **Perplexity** |
| Structured data extraction | ✓ Optimized | ⚠️ Possible      | **Perplexity** |
| Promotion comparison       | ✓ Capable   | ✓ Strong         | **Tie**        |
| Structured output          | ✓ Easy      | ✓ Possible       | **Perplexity** |
| Cost efficiency            | ✓ Optimized | ⚠️ Higher        | **Perplexity** |
| Automatic citations        | ✓ Always    | ⚠️ Only with web | **Perplexity** |

**Result**: Perplexity API better matches the project's core needs (real-time web research and structured data extraction) while being more cost-effective.

---

## Implementation Approach

The application will use **Perplexity API exclusively** for:

1. **Casino Discovery**: Finding licensed casinos in NJ, MI, PA, and WV
2. **Promotion Research**: Extracting current promotional offers from casino websites
3. **License Verification**: Accessing state gaming commission websites
4. **Promotion Comparison**: Identifying when discovered promotions are better than existing ones

This single-model approach simplifies implementation, reduces costs, and leverages Perplexity's strengths in web research and data extraction.

---

## Conclusion

Perplexity API was selected because it is purpose-built for the exact use case this project requires: real-time web research and structured data extraction. While GPT-4o is a powerful alternative, Perplexity's search-first architecture, automatic web access, and cost efficiency make it the better fit for discovering casinos and researching promotional offers.

This decision ensures the application can efficiently gather current data, extract structured information, and identify better promotional offers while maintaining transparency through automatic source citations.
