/**
 * @quvel-kit/tenancy
 *
 * Multi-tenant types and utilities for Quvel UI.
 * Provides tenant types and config filtering utilities.
 *
 * ## Extending TenantConfig
 * Add custom config fields in your app's types file:
 * ```typescript
 * declare module '@quvel-kit/tenancy' {
 *   interface TenantConfig {
 *     myFeature?: { enabled: boolean };
 *   }
 * }
 * ```
 *
 * ## Augmenting Core's AppConfig
 * If using @quvel-kit/core, import the augmentation in your app:
 * ```typescript
 * // app/types/core-augmentation.ts
 * import '@quvel-kit/tenancy/augment-core';
 * ```
 */

// Export all types
export type {
  // Tenant core types
  Tenant,
  TenantConfig,
  TenantResolutionResult,
  PublicTenantData,
  TenantAppConfig,

  // Config visibility
  ConfigVisibility,
  ConfigWithVisibility,

  // Tenant resolution strategies
  TenantResolutionStrategy,
  TenantStrategyConfig,
} from './types.js';

// Export utilities for config visibility filtering
export {
  filterConfigByVisibility,
  filterPublicConfig,
} from './utils.js';

// Export services
export {
  TenantResolver,
  TenantCacheService,
  TenantRequestHooks,
  type CacheMode,
  type TenantRequestHooksConfig,
  type TenantNotFoundAction,
  type MergeTenantConfigHandler,
} from './services/index.js';

// Export SSR plugin
export { createTenancyPlugin } from './plugin.js';

// Export config utilities
export { parseTenancyEnv } from './config/index.js';
export type { TenancyEnv } from './config/index.js';

// Export cookie configuration
export {
  createTenantXsrfCookieName,
  createTenantSessionCookieName,
} from './cookies.js';
