import * as Joi from 'joi';

/**
 * Validation schema for environment variables
 * Ensures all required configuration is present and valid
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_URL_TEST: Joi.string().optional(),
  POSTGRES_USER: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().optional(),
  POSTGRES_DB: Joi.string().optional(),

  // Perplexity API
  PERPLEXITY_API_KEY: Joi.string().optional(),
  PERPLEXITY_RATE_LIMIT_RPM: Joi.number().default(20),

  // Reel Edge DB
  REEL_EDGE_API_URL: Joi.string().uri().optional(),

  // Research Settings
  RESEARCH_SCHEDULE_CRON: Joi.string().default('0 0 * * *'),
  PROMOTION_BATCH_SIZE: Joi.number().min(5).max(10).default(7),

  // NextAuth
  NEXTAUTH_SECRET: Joi.string().optional(),
  NEXTAUTH_URL: Joi.string().uri().optional(),
});
