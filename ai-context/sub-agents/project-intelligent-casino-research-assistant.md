# Goal

Build a Intelligent Research Assistant to Identify Casinos and Promotions of NJ, MI, PA and WV
¿Why? In order to have the Reel Edge DB up to date with the best promotions.

> This is a proof-of-concept to demonstrate AI research capabilities, not a production system

# Context

Current Reel Edge DB: https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0/activeSUB

# Accomplish

1. Discover casino
   - IA for find Licensed/operational (NJ, MI, PA and WV)
   - Work with publicly accessible information only - no login/authentication required
   - No need to handle geo-restrictions or proxy management for this exercise
   - Ask AI to prioritize official sources (state gaming commissions, regulatory databases)
   - Compare against Reel Edge DB
2. Research Promotions (For each casino)
   1. research current CASINO (not sports) promotional offers
   2. Work with publicly accessible information only - no login/authentication required
   3. No need to handle geo-restrictions or proxy management for this exercise
   4. Compre against Reel Edge DB, Identify if there is better or different promotions.
   5. A better promo offer is: larger bonus (typically), if not sure display alternative offers
3. Display the research
   1. Create a minimal UI of the Research
      1. Missing casinos by state
      2. Offer comparison results (current vs. discovered)
   2. Should be easy to review and ==¿action on?==
4. Execution:
   1. On demand or scheduled (onece a day)
   2. Efficiency and API rate limits.

- Aside
  - Implement IA in a decoupled manner.
  - Implement Testing.
- Documentation
  - Document the limitation of using IA for this Research
  - Document the deployment steps.
  - Document the architecture of the solution (Clean and Mantainable)
  - README covering setup/execution instructions)
  - Demo output showing the system in action (sample results/screenshots)
  - Presentation (5-10 minute video and/or written document) explaining:
    - Your architectural approach and key technical decisions
    - AI tools/models used and why
    - Trade-offs and limitations
    - Challenges encountered and how you solved them
    - What you'd improve with more time
    - Anything else you’d like to include

# Clarifications

- The phrase "not sports" refers to excluding promotions related to sports betting or sports-related activities. Instead, the focus should be solely on casino-specific promotions, such as bonuses for slot machines, table games, or other casino-related activities. This distinction ensures that the research targets offers directly tied to casino gaming rather than sports betting.

# Questions

- I want to make sure I am researching the correct type of promotions. ​ The document says to focus on casino promotions, not sports promotions. ​ For example, should I include promotions for slot machines, table games, and other casino activities, but exclude any offers related to events like free bets on football games or basketball tournaments?
- Point 3 what does mean "action on"
