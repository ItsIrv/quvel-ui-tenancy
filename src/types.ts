import {AppConfig} from "@quvel-kit/core";

/**
 * Strongly typed tenant configuration matching backend structure.
 */
export interface TenantConfig {
  /**
   * Application configuration
   */
  app: AppConfig['app'];

  /**
   * Frontend configuration
   */
  frontend: AppConfig['frontend'];

  /**
   * Visibility metadata for config fields (from backend)
   */
  __visibility?: Record<string, any>;

  /**
   * Allow additional config keys
   */
  [key: string]: unknown;
}


/**
 * Tenant model matching backend API resource structure.
 */
export interface Tenant {
  /** UUID identifier */
  id: string;

  /** Tenant display name */
  name: string;

  /** Unique identifier (domain, subdomain, slug, etc.) */
  identifier: string;

  /** Parent tenant ID for hierarchical tenants */
  parent_id: string | null;

  /** Whether tenant is active */
  is_active: boolean;

  /** Whether the tenant is internal (can access protected endpoints) */
  is_internal: boolean;

  /** Structured configuration object (includes __visibility metadata) */
  config: TenantConfig;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Parent tenant (if hierarchical) */
  parent: Tenant | null;
}

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  /** Resolved tenant */
  tenant: Tenant | null;

  /** Whether result came from cache */
  fromCache: boolean;

  /** Resolution time in milliseconds */
  resolutionTime: number;
}

/**
 * Public tenant data sent to the client (excludes internal fields)
 */
export interface PublicTenantData {
  id: string;
  name: string;
  identifier: string;
  config: TenantConfig;
}

/**
 * Tenant-aware app config structure.
 * Core package will extend window.__APP_CONFIG__ with this.
 */
export interface TenantAppConfig {
  /** Tenant data (null for single-tenant or when no tenant resolved) */
  tenant: PublicTenantData | null;
}

/**
 * Config field visibility for filtering
 */
export type ConfigVisibility = 'public' | 'protected' | 'private';

/**
 * Config with visibility metadata (backend structure)
 */
export interface ConfigWithVisibility {
  __visibility?: Record<string, ConfigVisibility>;
  [key: string]: unknown;
}

/**
 * Tenant resolution strategies
 */
export type TenantResolutionStrategy = 'domain' | 'path' | 'header' | 'subdomain';

/**
 * Tenant resolution strategy configuration
 */
export interface TenantStrategyConfig {
  /**
   * Strategy type
   */
  strategy: TenantResolutionStrategy;

  /**
   * Header name (for 'header' strategy)
   */
  headerName?: string;

  /**
   * Path segment index (for 'path' strategy)
   * @example '/tenant1/page' with index 0 extracts 'tenant1'
   */
  pathIndex?: number;

  /**
   * Domain level for subdomain extraction (for 'subdomain' strategy)
   * @example 'tenant.app.com' with level 0 extracts 'tenant'
   */
  subdomainLevel?: number;
}
