/**
 * Global setup for tests
 * Runs once before all tests
 */
export default (): void => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Use test database URL if available
  if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  }

  console.log('🧪 Global test setup complete');
  console.log(
    `📊 Using database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`,
  );
};
