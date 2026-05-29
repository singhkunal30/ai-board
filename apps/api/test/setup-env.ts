/**
 * Provides a minimal valid environment so modules that validate config at
 * import time can be loaded under test without a real infrastructure.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-123456';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-12345';
process.env.AI_PROVIDER ??= 'mock';
process.env.LOG_LEVEL ??= 'error';
