/**
 * Tenant Cookie Configuration
 *
 * Provides cookie name generators that match Laravel backend conventions
 * for multi-tenant applications.
 *
 * Priority order for cookie names:
 * 1. Tenant config (e.g., config.session.name)
 * 2. Default tenant pattern (tenant_{id}_session)
 * 3. Global default (laravel_session)
 */

import type { PublicTenantData, TenantConfig } from './types.js';

/**
 * Cookie configuration structure (matches backend conventions)
 */
interface CookieConfig {
  xsrf?: {
    name?: string;
  };
  session?: {
    name?: string;
  };
}

/**
 * Creates XSRF cookie name for tenant
 *
 * Priority:
 * 1. Tenant config xsrf.name (custom cookie name from backend)
 * 2. Default pattern: `tenant_{tenant_id}_xsrf`
 * 3. Global default: `XSRF-TOKEN`
 *
 * @param tenant - Tenant data (contains config with optional cookie settings)
 * @returns XSRF cookie name
 *
 * @example
 * ```typescript
 * // With custom xsrf name in tenant config
 * createTenantXsrfCookieName({ id: '01K791XPER5WS4YBR34E9WDYF5', config: { xsrf: { name: 'custom_xsrf' } } })
 * // Returns: 'custom_xsrf'
 *
 * // With the default pattern
 * createTenantXsrfCookieName({ id: '01K791XPER5WS4YBR34E9WDYF5' })
 * // Returns: 'tenant_01K791XPER5WS4YBR34E9WDYF5_xsrf'
 * ```
 */
export function createTenantXsrfCookieName(tenant?: PublicTenantData | null): string {
  const cookieConfig = tenant?.config as TenantConfig & CookieConfig;
  const customName = cookieConfig?.xsrf?.name;

  if (customName) {
    return customName;
  }

  if (tenant?.id) {
    return `tenant_${tenant.id}_xsrf`;
  }

  return 'XSRF-TOKEN';
}

/**
 * Creates session cookie name for tenant
 *
 * Priority:
 * 1. Tenant config session.name (custom cookie name from backend)
 * 2. Default pattern: `tenant_{tenant_id}_session`
 * 3. Global default: `laravel_session`
 *
 * @param tenant - Tenant data (contains config with optional cookie settings)
 * @returns Session cookie name
 *
 * @example
 * ```typescript
 * // With custom session name in tenant config
 * createTenantSessionCookieName({ id: '01K791XPER5WS4YBR34E9WDYF5', config: { session: { name: 'custom_session' } } })
 * // Returns: 'custom_session'
 *
 * // With the default pattern
 * createTenantSessionCookieName({ id: '01K791XPER5WS4YBR34E9WDYF5' })
 * // Returns: 'tenant_01K791XPER5WS4YBR34E9WDYF5_session'
 * ```
 */
export function createTenantSessionCookieName(tenant?: PublicTenantData | null): string {
  const cookieConfig = tenant?.config as TenantConfig & CookieConfig;
  const customName = cookieConfig?.session?.name;

  if (customName) {
    return customName;
  }

  if (tenant?.id) {
    return `tenant_${tenant.id}_session`;
  }

  return 'laravel_session';
}
