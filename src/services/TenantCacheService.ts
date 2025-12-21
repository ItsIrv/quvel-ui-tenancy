import type { AxiosInstance, AxiosResponse } from 'axios';
import type { Tenant } from '../types.js';
import type {ILogger} from "@quvel-kit/ssr";

export type CacheMode = 'preload' | 'lazy' | 'disabled';

interface CacheEntry {
  tenant: Tenant;
  expiresAt: number;
}

interface TenantsApiResponse {
  data: Tenant[];
}

/**
 * Tenant Cache Service
 *
 * Supports three cache modes:
 * - preload: Load all tenants at startup using SSRApiService's axios instance
 * - lazy: Cache tenants as they are resolved with TTL
 * - disabled: No caching (for local dev)
 */
export class TenantCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly mode: CacheMode;
  private readonly ttl: number;
  private readonly endpointPrefix: string;
  private cleanupInterval?: NodeJS.Timeout;
  private logger?: ILogger;

  constructor(mode: CacheMode = 'lazy', ttlSeconds: number = 300, endpointPrefix: string = 'tenant-info') {
    this.mode = mode;
    this.ttl = ttlSeconds * 1000;
    this.endpointPrefix = endpointPrefix;
  }

  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  async initialize(axiosInstance: AxiosInstance): Promise<void> {
    if (this.mode === 'preload') {
      await this.preloadTenants(axiosInstance);
    }

    if (this.mode === 'lazy') {
      this.startCleanupInterval();
    }
  }

  /**
   * Get tenant from cache
   */
  get(key: string): Tenant | null {
    if (this.mode === 'disabled') {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (this.mode === 'lazy' && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.tenant;
  }

  /**
   * Set tenant in cache
   */
  set(key: string, tenant: Tenant): void {
    if (this.mode === 'disabled') {
      return;
    }

    const expiresAt = this.mode === 'preload' ? Infinity : Date.now() + this.ttl;
    this.cache.set(key, { tenant, expiresAt });
  }

  private async preloadTenants(axiosInstance: AxiosInstance): Promise<void> {
    try {
      const response: AxiosResponse<TenantsApiResponse> = await axiosInstance.get(
        `/${this.endpointPrefix}/cache`,
      );

      const tenants = response.data.data || (response.data as any) || [];

      for (const tenant of tenants) {
        const key = tenant.identifier || tenant.id;
        this.cache.set(key, { tenant, expiresAt: Infinity });
      }

      if (this.logger) {
        this.logger.info('Tenants preloaded into cache', {
          count: tenants.length,
          mode: this.mode,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.logger) {
        this.logger.error('Failed to preload tenants', {
          baseURL: axiosInstance.defaults.baseURL,
          error: errorMessage,
        });
      } else {
        console.error('Failed to preload tenants:', errorMessage);
      }
    }
  }

  /**
   * Delete tenant from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Start interval to clean up expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0 && this.logger) {
      this.logger.debug('Expired tenant cache entries cleaned up', {
        removed,
        remaining: this.cache.size,
      });
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}
