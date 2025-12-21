import type { Request } from 'express';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { Tenant, TenantStrategyConfig } from '../types.js';
import type { TenantResolutionMode } from '../config/env.js';

interface TenantApiResponse {
  data: Tenant;
}

/**
 * Tenant Resolver
 *
 * Resolves tenant information based on configurable resolution strategies.
 *
 * Resolution Strategies:
 * - domain: Match full domain (default)
 * - subdomain: Extract subdomain from hostname
 * - path: Extract tenant from URL path segment
 * - header: Read tenant identifier from HTTP header
 *
 * Resolution Modes:
 * - gateway: Use SSRApiService's axios instance (points to VITE_INTERNAL_API_URL)
 * - direct: Build URL as https://api.{identifier}/{endpoint} for each tenant
 */
export class TenantResolver {
  private strategy: TenantStrategyConfig;
  private resolutionMode: TenantResolutionMode;
  private endpointPrefix: string;

  constructor(
    strategy: TenantStrategyConfig = { strategy: 'domain' },
    resolutionMode: TenantResolutionMode = 'gateway',
    endpointPrefix: string = 'tenant-info',
  ) {
    this.strategy = strategy;
    this.resolutionMode = resolutionMode;
    this.endpointPrefix = endpointPrefix;
  }

  extractIdentifier(req: Request): string | null {
    switch (this.strategy.strategy) {
      case 'domain':
        return this.extractDomain(req);

      case 'subdomain':
        return this.extractSubdomain(req, this.strategy.subdomainLevel || 0);

      case 'path':
        return this.extractFromPath(req, this.strategy.pathIndex || 0);

      case 'header':
        return this.extractFromHeader(req, this.strategy.headerName || 'X-Tenant-ID');

      default:
        return null;
    }
  }

  private extractDomain(req: Request): string {
    const forwardedHost = req.get('x-forwarded-host');
    if (forwardedHost) {
      return forwardedHost.split(':')[0];
    }

    const host = req.get('host');
    if (host) {
      return host.split(':')[0];
    }

    return req.hostname;
  }

  private extractSubdomain(req: Request, level: number): string | null {
    const hostname = this.extractDomain(req);
    const parts = hostname.split('.');

    if (parts.length <= 2) {
      return null;
    }

    if (level >= 0 && level < parts.length - 2) {
      return parts[level];
    }

    return null;
  }

  private extractFromPath(req: Request, index: number): string | null {
    const path = req.path || req.url;
    const segments = path.split('/').filter((s: string) => s.length > 0);

    if (index >= 0 && index < segments.length) {
      return segments[index];
    }

    return null;
  }

  private extractFromHeader(req: Request, headerName: string): string | null {
    return req.get(headerName) || null;
  }

  async resolveTenantByIdentifier(
    identifier: string,
    axiosInstance: AxiosInstance,
  ): Promise<{ tenant: Tenant | null; error?: Error; url?: string }> {
    try {
      let url: string;

      if (this.resolutionMode === 'gateway') {
        url = `/${this.endpointPrefix}/protected`;
      } else {
        url = `https://api.${identifier}/${this.endpointPrefix}/protected`;
      }

      const response: AxiosResponse<TenantApiResponse> = await axiosInstance.get(
        url,
        {
          headers: {
            'X-Tenant-Override': identifier,
          },
        }
      );

      const tenant = response.data.data || response.data;
      return { tenant: tenant as Tenant, url };
    } catch (error) {
      if (error instanceof Error) {
        return { tenant: null, error };
      }
      return { tenant: null, error: new Error('Unknown error during tenant resolution') };
    }
  }

  resolveTenantFromEnv(): Tenant | null {
    const tenantId = process.env.VITE_TENANT_ID;
    const tenantName = process.env.VITE_TENANT_NAME;
    const apiUrl = process.env.VITE_API_URL || '';
    const appUrl = process.env.VITE_APP_URL || '';

    if (!tenantId || !tenantName) {
      return null;
    }

    const tenant: Tenant = {
      id: tenantId,
      name: tenantName,
      identifier: 'localhost',
      parent_id: null,
      is_active: true,
      is_internal: false,
      config: {
        app: {
          name: tenantName,
          url: apiUrl,
        },
        frontend: {
          url: appUrl,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      parent: null,
    };

    return tenant;
  }
}
