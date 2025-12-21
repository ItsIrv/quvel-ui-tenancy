import type { TenantStrategyConfig } from '../types.js';
import type { CacheMode } from '../services/TenantCacheService.js';

/**
 * Tenant resolution mode
 */
export type TenantResolutionMode = 'gateway' | 'direct';

/**
 * Parsed tenancy environment variables with defaults.
 */
export interface TenancyEnv {
  /** Whether multi-tenant mode is enabled */
  enabled: boolean;

  /** Tenant resolution strategy */
  strategy: TenantStrategyConfig;

  /** Resolution mode: gateway or direct */
  resolutionMode: TenantResolutionMode;

  /** Endpoint prefix for tenant API */
  endpointPrefix: string;

  /** Cache mode */
  cacheMode: CacheMode;

  /** Cache TTL in seconds */
  cacheTtl: number;
}

/**
 * Parse tenancy environment variables with type safety and defaults.
 *
 * Supported environment variables:
 * - TENANCY_ENABLED - Enable multi-tenancy (default: true)
 * - TENANCY_RESOLUTION_MODE - Resolution mode: gateway, direct (default: gateway)
 * - TENANCY_STRATEGY - Strategy: domain, subdomain, path, header (default: domain)
 * - TENANCY_SUBDOMAIN_LEVEL - Subdomain level for subdomain strategy (default: 0)
 * - TENANCY_PATH_INDEX - Path index for path strategy (default: 0)
 * - TENANCY_HEADER_NAME - Header name for header strategy (default: X-Tenant-ID)
 * - TENANCY_CACHE_MODE - Cache mode: preload, lazy, disabled (default: lazy)
 * - TENANCY_CACHE_TTL - Cache TTL in seconds (default: 300)
 * - TENANCY_ENDPOINT_PREFIX - API endpoint base prefix (default: tenant-info)
 *
 * Note: Gateway mode uses VITE_INTERNAL_API_URL (configured in SSRApiService)
 * Note: Direct mode builds URLs from tenant identifier as https://api.{identifier}/{endpoint}
 */
export function parseTenancyEnv(): TenancyEnv {
  const strategyType = (process.env.TENANCY_STRATEGY || 'domain') as 'domain' | 'subdomain' | 'path' | 'header';
  const resolutionMode = (process.env.TENANCY_RESOLUTION_MODE || 'gateway') as TenantResolutionMode;

  // Build strategy config based on type
  let strategy: TenantStrategyConfig;
  switch (strategyType) {
    case 'subdomain':
      strategy = {
        strategy: 'subdomain',
        subdomainLevel: Number(process.env.TENANCY_SUBDOMAIN_LEVEL) || 0,
      };
      break;
    case 'path':
      strategy = {
        strategy: 'path',
        pathIndex: Number(process.env.TENANCY_PATH_INDEX) || 0,
      };
      break;
    case 'header':
      strategy = {
        strategy: 'header',
        headerName: process.env.TENANCY_HEADER_NAME || 'X-Tenant-ID',
      };
      break;
    default:
      strategy = { strategy: 'domain' };
  }

  return {
    enabled: process.env.TENANCY_ENABLED !== 'false',
    strategy,
    resolutionMode,
    endpointPrefix: process.env.TENANCY_ENDPOINT_PREFIX || 'tenant-info',
    cacheMode: (process.env.TENANCY_CACHE_MODE as CacheMode) || 'lazy',
    cacheTtl: Number(process.env.TENANCY_CACHE_TTL) || 300,
  };
}
