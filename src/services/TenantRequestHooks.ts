/**
 * TenantRequestHooks
 *
 * SSR service that hooks into the request pipeline to:
 * - Resolve tenant based on configured strategy
 * - Cache tenant information
 * - Add tenant to request context
 * - Merge tenant config into window.__APP_CONFIG__
 * - Handle tenant not found scenarios
 */

/// <reference types="@quvel-kit/ssr" />

import type { Response } from 'express';
import type {ILogger, ISSRContainer, QuvelContext, SSRRequest, SSRSingletonService, WindowBag} from '@quvel-kit/ssr';
import {SSRApiService, SSRLogService, SSRRequestHandler, SSRService} from '@quvel-kit/ssr';
import type {AppConfig} from '@quvel-kit/core';
import {TenantResolver} from './TenantResolver.js';
import {TenantCacheService} from './TenantCacheService.js';
import type {TenantRequestHooksConfig} from './types.js';
import {createTenantSessionCookieName, createTenantXsrfCookieName} from '../cookies.js';
import {filterPublicConfig} from '../utils.js';
import type {Tenant, TenantConfig} from '../types.js';

/**
 * QuvelContext with tenant property (internal type assertion helper)
 * Note: Apps should augment QuvelContext in their env.d.ts for full type safety
 */
type TenantQuvelContext = QuvelContext & {
  tenant?: Tenant | null;
};

/**
 * Tenant Request Hooks Service (Singleton)
 *
 * Integrates tenant resolution into the SSR request pipeline
 */
export class TenantRequestHooks extends SSRService implements SSRSingletonService {
  private logger!: ILogger;
  private handler!: SSRRequestHandler;
  private apiService!: SSRApiService;
  private config: TenantRequestHooksConfig;
  private resolver: TenantResolver;
  private cache: TenantCacheService;
  private container!: ISSRContainer;

  constructor(config: TenantRequestHooksConfig) {
    super();
    this.config = config;

    const endpointPrefix = config.endpointPrefix || 'tenant-info';

    this.resolver = new TenantResolver(
      config.strategy,
      config.resolutionMode || 'gateway',
      endpointPrefix,
    );

    this.cache = new TenantCacheService(
      config.cache?.mode || 'lazy',
      config.cache?.ttl || 300,
      endpointPrefix,
    );
  }

  override register(container: ISSRContainer): void {
    this.container = container;
    this.handler = container.get(SSRRequestHandler);
    this.apiService = container.get(SSRApiService);
  }

  override async boot(): Promise<void> {
    this.logger = this.container.get(SSRLogService).createLogger('TenantRequestHooks');
    this.cache.setLogger(this.logger);

    if (!this.config.enabled) {
      this.logger.info('Tenant request hooks disabled');
      return;
    }

    const resolutionMode = this.config.resolutionMode || 'gateway';

    if (resolutionMode === 'gateway') {
      const axiosBaseURL = this.apiService.getAxiosInstance().defaults.baseURL;
      if (!axiosBaseURL) {
        throw new Error(
          'Gateway resolution mode requires VITE_INTERNAL_API_URL to be configured (used as SSRApiService baseURL)'
        );
      }
    }

    if (this.config.cache?.mode !== 'disabled') {
      await this.cache.initialize(this.apiService.getAxiosInstance());
    }

    this.handler.onPreRender(this.enrichWindowBag.bind(this));

    this.logger.info('Tenant request hooks booted', {
      resolutionMode,
      strategy: this.config.strategy.strategy,
      cacheMode: this.config.cache?.mode || 'lazy',
    });
  }

  /**
   * Main hook: Resolve tenant and enrich both SSR context and public WindowBag config
   */
  private async enrichWindowBag(req: SSRRequest, bag: WindowBag, _res: Response): Promise<void> {
    const tenant = await this.resolveTenant(req);

    if (!tenant) {
      if (this.config.onTenantNotFound?.type === 'render') {
        return;
      }

      await this.handleTenantNotFound(req, bag);
      
      return;
    }

    this.buildSsrContext(req, tenant);
    this.buildPublicConfig(req, tenant, bag);
  }

  /**
   * Handles caching and logging
   */
  private async resolveTenant(req: SSRRequest): Promise<Tenant | null> {
    const resolutionStartTime = Date.now();

    try {
      const identifier = this.resolver.extractIdentifier(req);

      if (!identifier) {
        this.logger.warning('Could not extract tenant identifier', {
          strategy: this.config.strategy.strategy,
        });
        return null;
      }

      let tenant = this.cache.get(identifier);

      if (tenant) {
        this.logger.debug('Tenant resolved from cache', {
          identifier,
          tenantId: tenant.id,
        });
        return tenant;
      }

      const result = await this.resolver.resolveTenantByIdentifier(
        identifier,
        this.apiService.getAxiosInstance(),
      );

      if (result.error) {
        this.logger.error('Tenant API resolution failed', {
          identifier,
          error: result.error.message,
        });
        return null;
      }

      tenant = result.tenant;

      if (tenant) {
        this.cache.set(identifier, tenant);
        this.logger.info('Tenant resolved from API', {
          identifier,
          tenantId: tenant.id,
          resolutionTime: Date.now() - resolutionStartTime,
        });
      } else {
        this.logger.warning('Tenant not found', { identifier });
      }

      return tenant;
    } catch (error) {
      this.logger.error('Tenant resolution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Shared helper: Ensure req.quvelContext is initialized
   */
  private ensureQuvelContext(req: SSRRequest): void {
    if (!req.quvelContext) {
      req.quvelContext = { startTime: Date.now() };
    }
  }

  /**
   * Shared helper: Extract and filter public tenant config using visibility metadata
   */
  private extractPublicTenantConfig(tenant: Tenant): Record<string, any> {
    const visibility = tenant.config.__visibility;
    const { __visibility, ...configWithoutMeta } = tenant.config as any;

    let publicTenantConfig: Record<string, any> = {};

    if (visibility && Object.keys(visibility).length > 0) {
      publicTenantConfig = filterPublicConfig(configWithoutMeta, visibility);
    } else {
      this.logger.warning('No __visibility metadata found in tenant.config, skipping config filtering', {
        tenantId: tenant.id,
      });
    }

    return publicTenantConfig;
  }

  /**
   * Sets tenant and cookie config for internal SSR axios requests
   * Merges tenant config so SSR rendering matches browser hydration
   */
  private buildSsrContext(req: SSRRequest, tenant: Tenant): void {
    this.ensureQuvelContext(req);

    (req.quvelContext as TenantQuvelContext).tenant = tenant;

    if (!req.quvelContext!.appConfig) {
      req.quvelContext!.appConfig = {} as AppConfig;
    }

    const publicTenantConfig = this.extractPublicTenantConfig(tenant);
    const mergeHandler = this.config.mergeTenantConfig || this.defaultMergeTenantConfig.bind(this);
    mergeHandler(req.quvelContext!.appConfig, publicTenantConfig);

    if (!req.quvelContext!.appConfig.session) {
      req.quvelContext!.appConfig.session = {};
    }

    req.quvelContext!.appConfig.session.cookie = createTenantSessionCookieName(tenant);
    req.quvelContext!.appConfig.session.xsrf_cookie = createTenantXsrfCookieName(tenant);
  }

  /**
   * Filters sensitive data and merges tenant config into WindowBag
   */
  private buildPublicConfig(req: SSRRequest, tenant: Tenant, bag: WindowBag): void {
    const config = bag.get<AppConfig>('__APP_CONFIG__') || {} as AppConfig;

    if (req.quvelContext?.appConfig?.session) {
      if (!config.session) {
        config.session = {};
      }

      if (req.quvelContext.appConfig.session.xsrf_cookie) {
        config.session.xsrf_cookie = req.quvelContext.appConfig.session.xsrf_cookie;
      }
    }

    const publicTenantConfig = this.extractPublicTenantConfig(tenant);
    const mergeHandler = this.config.mergeTenantConfig || this.defaultMergeTenantConfig.bind(this);
    mergeHandler(config, publicTenantConfig);

    config.tenant = {
      id: tenant.id,
      name: tenant.name,
      identifier: tenant.identifier,
      parent_id: tenant.parent_id,
      is_active: tenant.is_active,
      is_internal: tenant.is_internal,
      config: publicTenantConfig,
    };

    if (config.trace) {
      config.trace.tenant = tenant.id;
    }

    if (config.session?.cookie) {
      const { cookie, ...safeSession } = config.session;
      config.session = safeSession;
    }

    bag.set('__APP_CONFIG__', config);
  }

  private async handleTenantNotFound(req: SSRRequest, _bag: WindowBag): Promise<void> {
    const action = this.config.onTenantNotFound || { type: '404' as const };

    switch (action.type) {
      case '404': {
        const error = new Error('Tenant not found') as Error & { code: number };
        error.code = 404;
        throw error;
      }

      case 'redirect': {
        const error = new Error('Redirecting to tenant not found page') as Error & { url: string; code: number };
        error.url = action.url;
        error.code = action.code || 302;
        throw error;
      }

      case 'render': {
        if (!req.quvelContext) {
          req.quvelContext = {
            startTime: Date.now(),
          };
        }
        (req.quvelContext as TenantQuvelContext).tenant = null;
        break;
      }

      case 'custom': {
        if (action.handler) {
          await action.handler(req, null);
        }
        break;
      }
    }
  }

  private defaultMergeTenantConfig(baseConfig: AppConfig, tenantConfig: Partial<TenantConfig>): void {
    if (tenantConfig.app) {
      if (!baseConfig.app) baseConfig.app = { name: '', url: '' };
      if (tenantConfig.app.name !== undefined) {
        baseConfig.app.name = tenantConfig.app.name;
      }
      if (tenantConfig.app.url !== undefined) {
        baseConfig.app.url = tenantConfig.app.url;
      }
      if (tenantConfig.app.env !== undefined) {
        baseConfig.app.env = tenantConfig.app.env;
      }
      if (tenantConfig.app.debug !== undefined) {
        baseConfig.app.debug = tenantConfig.app.debug;
      }
      if (tenantConfig.app.timezone !== undefined) {
        baseConfig.app.timezone = tenantConfig.app.timezone;
      }
      if (tenantConfig.app.locale !== undefined) {
        baseConfig.app.locale = tenantConfig.app.locale;
      }
      if (tenantConfig.app.fallback_locale !== undefined) {
        baseConfig.app.fallback_locale = tenantConfig.app.fallback_locale;
      }
    }

    if (tenantConfig.frontend) {
      if (!baseConfig.frontend) baseConfig.frontend = { url: '' };
      if (tenantConfig.frontend.url !== undefined) {
        baseConfig.frontend.url = tenantConfig.frontend.url;
      }
      if (tenantConfig.frontend.custom_scheme !== undefined) {
        baseConfig.frontend.custom_scheme = tenantConfig.frontend.custom_scheme;
      }
    }
  }

  override destroy(): void {
    this.cache.destroy();
  }
}
