/**
 * Optional Core Package Augmentation
 *
 * Loaded automatically via @quvel-kit/core/global
 * This uses TypeScript declaration merging to extend the AppConfig interface.
 */

// Import from core to establish this is an augmentation, not a replacement
import type { AppConfig as _AppConfig } from '@quvel-kit/core';

declare module '@quvel-kit/core' {
  interface AppConfig {
    /**
     * Tenant metadata (added by @quvel-kit/tenancy)
     * Present when multi-tenant mode is enabled and tenant is resolved
     * Note: Tenant config is merged into root AppConfig, not duplicated here
     */
    tenant?: {
      id: string;
      name: string;
      identifier: string;
      parent_id: string | null;
      is_active: boolean;
      is_internal: boolean;
    } | null;
  }
}
