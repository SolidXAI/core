import { ForbiddenException } from '@nestjs/common';

/**
 * True when the current environment looks like production (ENV/NODE_ENV).
 * Mirrors the convention in cache.helper.ts.
 */
export function isProductionEnv(): boolean {
  const env = (process.env.ENV ?? process.env.NODE_ENV ?? '').toLowerCase();
  return env === 'prod' || env === 'production';
}

/**
 * Gate for the DESTRUCTIVE test-lifecycle prepare-hook (reset/seed/load wipe + refill
 * the database). ALL of these must hold, otherwise a ForbiddenException is thrown so a
 * live database can never be reset by accident:
 *   1. SOLID_TEST_LIFECYCLE_ENABLED === 'true'   (explicit opt-in; default OFF)
 *   2. the environment is NOT production          (ENV/NODE_ENV not prod/production)
 *   3. if SOLID_TEST_LIFECYCLE_SECRET is set, the caller's secret must match it
 */
export function assertTestLifecycleAllowed(providedSecret?: string): void {
  if (process.env.SOLID_TEST_LIFECYCLE_ENABLED !== 'true') {
    throw new ForbiddenException(
      'Test lifecycle is disabled. Set SOLID_TEST_LIFECYCLE_ENABLED=true on a dedicated test environment to enable it.',
    );
  }

  if (isProductionEnv()) {
    throw new ForbiddenException(
      'Test lifecycle is not allowed in a production environment.',
    );
  }

  const expectedSecret = process.env.SOLID_TEST_LIFECYCLE_SECRET;
  if (expectedSecret && providedSecret !== expectedSecret) {
    throw new ForbiddenException('Invalid or missing test lifecycle secret.');
  }
}
