import type { Request } from 'express';
import type { TenantStrategyConfig, Tenant, TenantConfig } from '../types.js';
import type { CacheMode } from './TenantCacheService.js';
import type { TenantResolutionMode } from '../config/env.js';
import type { AppConfig } from '@quvel-kit/core';

/**
 * Tenant is not found action
 */
export type TenantNotFoundAction =
  | { type: '404' }
  | { type: 'redirect'; url: string; code?: number }
  | { type: 'render' }
  | { type: 'custom'; handler: (req: Request, tenant: Tenant | null) => void | Promise<void> };

/**
 * Merge tenant config handler function
 * Allows customization of how tenant config properties are merged into app config
 */
export type MergeTenantConfigHandler = (
  baseConfig: AppConfig,
  tenantConfig: Partial<TenantConfig>
) => void;

/**
 * Tenant request hooks configuration
 */
export interface TenantRequestHooksConfig {
  /** Whether multi-tenant mode is enabled */
  enabled: boolean;

  /** Tenant resolution mode: gateway or direct */
  resolutionMode?: TenantResolutionMode;

  /** Tenant resolution strategy */
  strategy: TenantStrategyConfig;

  /** Endpoint prefix for tenant API */
  endpointPrefix?: string;

  /** Cache configuration */
  cache?: {
    mode?: CacheMode;
    ttl?: number;
  };

  /** What to do when a tenant is not found */
  onTenantNotFound?: TenantNotFoundAction;

  /** Custom function to merge tenant config properties into app config */
  mergeTenantConfig?: MergeTenantConfigHandler;
}
