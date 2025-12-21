# @quvel-kit/tenancy

Multi-tenancy plugin for `@quvel-kit/ssr`. Resolves tenant information from incoming SSR requests and injects tenant-specific configuration into your application.

## What is Multi-Tenancy?

Multi-tenancy allows a single application instance to serve multiple customers (tenants). Each tenant gets isolated data and configuration while sharing the same codebase and infrastructure.

This package handles the **SSR side**—identifying which tenant is making the request and loading their configuration before rendering. It integrates with `@quvel-kit/ssr` and injects tenant data into `@quvel-kit/core`'s AppConfig system.

## Installation

```bash
yarn add @quvel-kit/tenancy
```

## Quick Start

In `src-ssr/ssr.config.ts`:

```typescript
import { defineSSRConfig } from '@quvel-kit/ssr';
import { createTenancyPlugin } from '@quvel-kit/tenancy';

export default defineSSRConfig({
  plugins: [
    createTenancyPlugin(), // Uses environment variables by default
  ],
});
```

Set environment variables:

```bash
TENANCY_ENABLED=true
TENANCY_STRATEGY=domain
TENANCY_RESOLUTION_MODE=gateway
TENANCY_CACHE_MODE=lazy
VITE_INTERNAL_API_URL=http://localhost:8000
```

That's it. The plugin handles tenant resolution automatically on every SSR request.

## How It Works

**Request Flow:**
1. Request comes in to SSR server
2. Plugin extracts tenant identifier from request (domain, subdomain, path, or header)
3. Checks cache for tenant data
4. If not cached, fetches from your backend API
5. Merges tenant configuration into AppConfig
6. Adds tenant ID to trace context
7. Renders page with tenant-specific data

The tenant data becomes available:
- **Server-side**: via `req.quvelContext.tenant` and `req.requestContext.appConfig.tenant`
- **Client-side**: via `window.__APP_CONFIG__.tenant` and the `useQuvel()` composable

## Resolution Strategies

The strategy determines how to extract the tenant identifier from incoming requests.

### Domain Strategy (Default)

Identifies tenants by full domain name.

```bash
TENANCY_STRATEGY=domain
```

Examples:
- `acme.com` → tenant identifier "acme.com"
- `globex.com` → tenant identifier "globex.com"

**Use when:** Each tenant has their own domain.

### Subdomain Strategy

Identifies tenants by subdomain at a specific level.

```bash
TENANCY_STRATEGY=subdomain
TENANCY_SUBDOMAIN_LEVEL=0  # First subdomain (default)
```

Examples with level `0`:
- `acme.myapp.com` → tenant identifier "acme"
- `globex.myapp.com` → tenant identifier "globex"

Examples with level `1`:
- `app.acme.myapp.com` → tenant identifier "acme"

**Use when:** All tenants share a parent domain with unique subdomains.

### Path Strategy

Identifies tenants by URL path segment at a specific index.

```bash
TENANCY_STRATEGY=path
TENANCY_PATH_INDEX=0  # First path segment (default)
```

Examples with index `0`:
- `/acme/dashboard` → tenant identifier "acme"
- `/globex/dashboard` → tenant identifier "globex"

**Use when:** Tenants share a domain and are separated by URL paths.

### Header Strategy

Identifies tenants by HTTP header value.

```bash
TENANCY_STRATEGY=header
TENANCY_HEADER_NAME=X-Tenant-ID  # Default header name
```

Example request:
```http
GET /dashboard
X-Tenant-ID: acme
```
→ tenant identifier "acme"

**Use when:** Requests come from internal services or proxies that add tenant headers.

## Resolution Modes

The resolution mode determines how the SSR server fetches tenant data from your backend.

### Gateway Mode (Default)

SSR server calls an internal gateway API to resolve tenants. The gateway API URL is configured via `VITE_INTERNAL_API_URL`, which is also used by `@quvel-kit/ssr`'s SSRApiService.

```bash
TENANCY_RESOLUTION_MODE=gateway
VITE_INTERNAL_API_URL=http://internal-gateway:8000
```

The SSR server will call:
```
GET http://internal-gateway:8000/tenant-info/protected
X-Tenant-Override: <identifier>
```

**Use when:** You have a centralized API gateway handling tenant resolution.

### Direct Mode

SSR server builds tenant-specific API URLs directly from the identifier. For example, if the identifier is `acme.com`, it calls `https://api.acme.com/tenant-info/protected`.

```bash
TENANCY_RESOLUTION_MODE=direct
```

The SSR server will call:
```
GET https://api.<identifier>/tenant-info/protected
X-Tenant-Override: <identifier>
```

**Use when:** Each tenant has their own API endpoint following a predictable `api.<identifier>` pattern.

## Cache Modes

Caching reduces API calls for tenant resolution.

### Lazy Mode (Default)

Caches tenants as they're resolved. First request for a tenant hits the API, subsequent requests use cache until TTL expires.

```bash
TENANCY_CACHE_MODE=lazy
TENANCY_CACHE_TTL=300  # 5 minutes (default)
```

**Use when:** Production environments with moderate traffic. Good balance between performance and freshness.

### Preload Mode

Loads all tenants at startup from the gateway API. Zero-latency resolution after initial load.

```bash
TENANCY_CACHE_MODE=preload
VITE_INTERNAL_API_URL=http://internal-gateway:8000
```

The SSR server calls `GET http://internal-gateway:8000/tenant-info/cache` on startup to load all tenants.

**Note:** Only works with `gateway` resolution mode.

**Use when:** High-traffic production with a manageable number of tenants (< 1000). Provides best performance.

### Disabled Mode

No caching. Every request hits the API.

```bash
TENANCY_CACHE_MODE=disabled
```

**Use when:** Local development or when tenant data changes very frequently.

## Environment Variables

All configuration uses environment variables by default:

| Variable | Default | Description |
|----------|---------|-------------|
| `TENANCY_ENABLED` | `true` | Enable multi-tenancy |
| `TENANCY_RESOLUTION_MODE` | `gateway` | Resolution mode: `gateway` or `direct` |
| `TENANCY_STRATEGY` | `domain` | Strategy: `domain`, `subdomain`, `path`, or `header` |
| `TENANCY_SUBDOMAIN_LEVEL` | `0` | Subdomain position for subdomain strategy (0=first, 1=second, etc.) |
| `TENANCY_PATH_INDEX` | `0` | Path segment index for path strategy |
| `TENANCY_HEADER_NAME` | `X-Tenant-ID` | Header name for header strategy |
| `TENANCY_CACHE_MODE` | `lazy` | Cache mode: `preload`, `lazy`, or `disabled` |
| `TENANCY_CACHE_TTL` | `300` | Cache TTL in seconds (lazy mode only) |
| `TENANCY_ENDPOINT_PREFIX` | `tenant-info` | API endpoint prefix (plugin appends `/protected` or `/cache`) |
| `VITE_INTERNAL_API_URL` | - | Internal gateway API URL (gateway mode and SSRApiService) |

## Override Configuration

You can override specific values while keeping environment-based defaults:

```typescript
createTenancyPlugin({
  cache: {
    mode: 'disabled', // Override just cache mode for development
  },
})
```

Full explicit configuration example:

```typescript
createTenancyPlugin({
  enabled: true,
  resolutionMode: 'gateway',
  strategy: { strategy: 'subdomain', subdomainLevel: 1 },
  endpointPrefix: 'tenant-info',
  cache: {
    mode: 'lazy',
    ttl: 600, // 10 minutes
  },
  onTenantNotFound: { type: '404' },
})
```

## API Contract

Your backend must provide tenant resolution endpoints.

### Tenant Resolution Endpoint

**Gateway Mode:** `GET {VITE_INTERNAL_API_URL}/{TENANCY_ENDPOINT_PREFIX}/protected`

**Direct Mode:** `GET https://api.{identifier}/{TENANCY_ENDPOINT_PREFIX}/protected`

The SSR server sends the tenant identifier via the `X-Tenant-Override` header.

**Request:**
```http
GET /tenant-info/protected
X-Tenant-Override: acme
```

**Response:**
```json
{
  "data": {
    "id": "tenant-123",
    "name": "Acme Corp",
    "identifier": "acme",
    "parent_id": null,
    "is_active": true,
    "is_internal": false,
    "config": {
      "app": {
        "name": "Acme Portal",
        "url": "https://api.acme.com",
        "env": "production",
        "debug": false,
        "timezone": "America/New_York",
        "locale": "en-US",
        "fallback_locale": "en"
      },
      "frontend": {
        "url": "https://acme.com",
        "custom_scheme": "acme://"
      },
      "branding": {
        "logo": "https://cdn.example.com/acme-logo.png",
        "primaryColor": "#FF6B35"
      },
      "features": {
        "analytics": true,
        "chat": false
      }
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "parent": null
  }
}
```

The `config` object must include `app` and `frontend` fields. Additional custom fields are supported via TypeScript module augmentation.

### Preload Cache Endpoint (Gateway Mode Only)

**Endpoint:** `GET {VITE_INTERNAL_API_URL}/{TENANCY_ENDPOINT_PREFIX}/cache`

**Response:**
```json
{
  "data": [
    {
      "id": "tenant-123",
      "identifier": "acme",
      "name": "Acme Corp",
      "is_active": true,
      "is_internal": false,
      "config": {
        "app": { "name": "Acme Portal", "url": "https://api.acme.com" },
        "frontend": { "url": "https://acme.com" }
      }
    },
    {
      "id": "tenant-456",
      "identifier": "globex",
      "name": "Globex Inc",
      "is_active": true,
      "is_internal": false,
      "config": {
        "app": { "name": "Globex Portal", "url": "https://api.globex.com" },
        "frontend": { "url": "https://globex.com" }
      }
    }
  ]
}
```

## Accessing Tenant Data

### Server-Side (SSR)

Tenant data is available on the request context:

```typescript
import type { SSRRequest } from '@quvel-kit/ssr';

export function myHandler(req: SSRRequest) {
  // Direct access via quvelContext
  const tenant = req.quvelContext?.tenant;
  console.log(tenant?.name); // "Acme Corp"
  console.log(tenant?.identifier); // "acme"
  console.log(tenant?.config.app.name); // "Acme Portal"
  console.log(tenant?.config.branding?.logo); // Custom config fields

  // Also available in AppConfig
  const appConfig = req.requestContext?.appConfig;
  console.log(appConfig?.tenant); // Same tenant object
  console.log(appConfig?.trace?.tenant); // Tenant ID in trace context
}
```

### Client-Side

Tenant data is injected into `window.__APP_CONFIG__` and accessible via the service container:

```typescript
import { useQuvel } from '@quvel-kit/core';

const { config } = useQuvel();

console.log(config.tenant?.name); // "Acme Corp"
console.log(config.tenant?.identifier); // "acme"
console.log(config.tenant?.config.app.name); // "Acme Portal"
console.log(config.tenant?.config.branding?.logo); // Custom config fields
console.log(config.trace?.tenant); // Tenant ID in trace context
```

The tenant ID in `trace.tenant` is automatically included in API request headers (`X-Trace-ID`) for distributed tracing across your application.

## Types

The `TenantConfig` interface defines the structure of tenant configuration with required base fields:

```typescript
interface TenantConfig {
  app: {
    name: string;
    url: string;
    env?: string;
    debug?: boolean;
    timezone?: string;
    locale?: string;
    fallback_locale?: string;
  };
  frontend: {
    url: string;
    custom_scheme?: string;
  };
  [key: string]: unknown; // Allows custom fields
}
```

### Extend TenantConfig with Custom Fields

Add custom configuration fields in your app's type declarations:

```typescript
// app/types/tenancy.d.ts
declare module '@quvel-kit/tenancy' {
  interface TenantConfig {
    branding?: {
      logo: string;
      primaryColor: string;
      secondaryColor?: string;
    };
    features?: {
      analytics: boolean;
      chat: boolean;
      twoFactor?: boolean;
    };
  }
}
```

### Augment Core's AppConfig

To make tenant types available in `@quvel-kit/core`'s AppConfig, import the augmentation:

```typescript
// app/types/core-augmentation.ts
import '@quvel-kit/tenancy/augment-core';
```

This adds the `tenant` field to AppConfig and `tenant` to the trace context automatically.

## Tenant Not Found Handling

Configure what happens when tenant resolution fails. By default, returns a 404 error.

### Available Actions

**404 Error (Default):**
```typescript
createTenancyPlugin({
  onTenantNotFound: { type: '404' },
})
```

**Redirect:**
```typescript
createTenancyPlugin({
  onTenantNotFound: {
    type: 'redirect',
    url: '/not-found',
    code: 302, // Optional redirect code
  },
})
```

**Render with Null Tenant:**
```typescript
createTenancyPlugin({
  onTenantNotFound: { type: 'render' },
})
```
The app renders normally but `config.tenant` will be `null`.

**Custom Handler:**
```typescript
createTenancyPlugin({
  onTenantNotFound: {
    type: 'custom',
    handler: (req, res, identifier) => {
      // Your custom logic
      res.status(404).send('Tenant not found');
    },
  },
})
```

## Cookie Utilities

For multi-tenant apps, you may want tenant-specific session and XSRF cookies:

```typescript
import { createTenantSessionCookieName, createTenantXsrfCookieName } from '@quvel-kit/tenancy';

const sessionCookieName = createTenantSessionCookieName('acme');
// "quvel_session_acme"

const xsrfCookieName = createTenantXsrfCookieName('acme');
// "XSRF-TOKEN-acme"
```

These utilities help prevent cookie conflicts between tenants on the same parent domain.

## Development

```bash
# Build package
yarn build

# Watch mode
yarn dev

# Clean build artifacts
yarn clean
```

## License

MIT
