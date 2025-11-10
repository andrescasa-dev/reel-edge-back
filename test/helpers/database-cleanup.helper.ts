import { PrismaClient } from '@prisma/client';

/**
 * Database cleanup helper for tests
 * Cleans all tables before each test to ensure isolation
 */
export class DatabaseCleanupHelper {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Clean all tables in the database
   * Execute in reverse order to respect foreign key constraints
   */
  async cleanDatabase(): Promise<void> {
    const tables = [
      'promotion_comparisons',
      'missing_casinos',
      'casinos',
      'research_jobs',
      'scheduled_jobs',
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Table might not exist yet, ignore error
        console.warn(`Warning: Could not truncate table ${table}.`);
      }
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Get Prisma client instance
   */
  getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}

/**
 * Helper function to clean database
 * Reuses existing Prisma instance when provided, otherwise creates a new one
 * Use in beforeEach hooks
 *
 * @param prisma - Optional PrismaClient instance to reuse
 */
export async function cleanDatabase(prisma?: PrismaClient): Promise<void> {
  const client = prisma || new PrismaClient();

  const tables = [
    'promotion_comparisons',
    'missing_casinos',
    'casinos',
    'research_jobs',
    'scheduled_jobs',
  ];

  for (const table of tables) {
    try {
      await client.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Table might not exist yet, ignore error
      console.warn(`Warning: Could not truncate table ${table}.`);
    }
  }

  // Only disconnect if we created a new client
  if (!prisma) {
    await client.$disconnect();
  }
}
