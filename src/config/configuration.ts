/**
 * Configuration factory for the application
 * Loads and validates environment variables
 */
export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
    testUrl: process.env.DATABASE_URL_TEST,
    postgresUser: process.env.POSTGRES_USER,
    postgresPassword: process.env.POSTGRES_PASSWORD,
    postgresDb: process.env.POSTGRES_DB,
  },

  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    rateLimitRpm: parseInt(process.env.PERPLEXITY_RATE_LIMIT_RPM || '20', 10),
  },

  reelEdge: {
    apiUrl:
      process.env.REEL_EDGE_API_URL ||
      'https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0',
  },

  research: {
    scheduleCron: process.env.RESEARCH_SCHEDULE_CRON || '0 0 * * *',
    promotionBatchSize: parseInt(process.env.PROMOTION_BATCH_SIZE || '7', 10),
  },

  nextAuth: {
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL,
  },
});
