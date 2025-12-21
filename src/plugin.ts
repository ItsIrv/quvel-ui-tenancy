import type { SSRPlugin } from '@quvel-kit/ssr';
import { TenantRequestHooks } from './services/TenantRequestHooks.js';
import type { TenantRequestHooksConfig } from './services/types.js';
import { parseTenancyEnv } from './config/env.js';

/**
 * Create a tenancy plugin for SSR.
 *
 * By default, reads configuration from environment variables:
 * - TENANCY_ENABLED - Enable multi-tenancy (default: true)
 * - TENANCY_RESOLUTION_MODE - Resolution mode: gateway, direct (default: gateway)
 * - TENANCY_STRATEGY - Strategy: domain, subdomain, path, header (default: domain)
 * - TENANCY_CACHE_MODE - Cache mode: preload, lazy, disabled (default: lazy)
 * - TENANCY_CACHE_TTL - Cache TTL in seconds (default: 300)
 * - TENANCY_ENDPOINT_PREFIX - API endpoint base prefix (default: tenant-info)
 *
 * Gateway mode uses SSRApiService's axios instance (configured via VITE_INTERNAL_API_URL).
 * Direct mode builds URLs from tenant identifier as https://api.{identifier}/{endpoint}.
 *
 * You can override any env-based config by passing explicit values.
 *
 * @example
 * ```typescript
 * import { defineSSRConfig } from '@quvel-kit/ssr';
 * import { createTenancyPlugin } from '@quvel-kit/tenancy';
 *
 * export default defineSSRConfig({
 *   plugins: [
 *     // Use all env vars
 *     createTenancyPlugin(),
 *
 *     // Or override specific values
 *     createTenancyPlugin({
 *       cache: { mode: 'disabled' }
 *     })
 *   ]
 * });
 * ```
 */
export function createTenancyPlugin(userConfig: Partial<TenantRequestHooksConfig> = {}): SSRPlugin {
  const env = parseTenancyEnv();

  // Build base config from env
  const baseConfig: TenantRequestHooksConfig = {
    enabled: env.enabled,
    resolutionMode: env.resolutionMode,
    strategy: env.strategy,
    endpointPrefix: env.endpointPrefix,
    cache: {
      mode: env.cacheMode,
      ttl: env.cacheTtl,
    },
  };

  // Merge with user config (user wins)
  const config: TenantRequestHooksConfig = {
    ...baseConfig,
    ...userConfig,
    cache: {
      ...baseConfig.cache,
      ...userConfig.cache,
    },
  };

  return {
    name: 'tenancy',
    services: [
      {
        name: 'TenantRequestHooks',
        instance: new TenantRequestHooks(config),
      },
    ],
  };
}
