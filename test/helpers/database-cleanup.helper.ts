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
      'PromotionComparison',
      'MissingCasino',
      'Casino',
      'ResearchJob',
      'ScheduledJob',
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
 * Use in beforeEach hooks
 */
export async function cleanDatabase(): Promise<void> {
  const helper = new DatabaseCleanupHelper();
  await helper.cleanDatabase();
  await helper.disconnect();
}
