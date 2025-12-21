import type { ConfigVisibility } from './types.js';

/**
 * Check if a value is a plain object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const output: Record<string, unknown> = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue });
        } else {
          output[key] = deepMerge(target[key] as Record<string, unknown>, sourceValue);
        }
      } else {
        Object.assign(output, { [key]: sourceValue });
      }
    });
  }

  return output as T;
}

/**
 * Check if the visibility level is allowed based on the minimum visibility requirement.
 * Order: public > protected > private
 */
function isVisibilityAllowed(
  fieldVisibility: ConfigVisibility,
  minVisibility: ConfigVisibility,
): boolean {
  const levels: Record<ConfigVisibility, number> = {
    public: 3,
    protected: 2,
    private: 1,
  };

  return levels[fieldVisibility] >= levels[minVisibility];
}

/**
 * Filter config to only include fields matching visibility level.
 * Mirror backend's filterByVisibilityKeys logic.
 *
 * @param config - Configuration object (without __visibility)
 * @param visibility - Visibility metadata tree
 * @param minVisibility - Minimum visibility level required
 *
 * @example
 * const config = { app: { url: 'https://api.example.com', key: 'secret' }, frontend: { url: 'https://app.example.com' } };
 * const visibility = { app: { url: 'public', key: 'private' }, frontend: { url: 'public' } };
 * const filtered = filterConfigByVisibility(config, visibility, 'public');
 * // Returns: { app: { url: 'https://api.example.com' }, frontend: { url: 'https://app.example.com' } }
 */
export function filterConfigByVisibility(
  config: Record<string, any>,
  visibility: Record<string, any>,
  minVisibility: ConfigVisibility = 'public',
): Record<string, any> {
  const visibilityTree = visibility || {};

  /**
   * Recursively filter by looping through the visibility tree.
   * More efficient since we only check explicitly visible keys.
   */
  function filterByVisibilityKeys(
    visibility: Record<string, any>,
    configData: Record<string, any>,
  ): Record<string, any> {
    const filtered: Record<string, any> = {};

    for (const [key, visValue] of Object.entries(visibility)) {
      if (typeof visValue === 'object' && visValue !== null && !Array.isArray(visValue)) {
        const childConfig = configData[key];

        if (typeof childConfig === 'object' && childConfig !== null && !Array.isArray(childConfig)) {
          const filteredChild = filterByVisibilityKeys(visValue, childConfig);

          if (Object.keys(filteredChild).length > 0) {
            filtered[key] = filteredChild;
          }
        }
      } else {
        const vis = (typeof visValue === 'string' ? visValue.toLowerCase() : visValue) as ConfigVisibility || 'private';

        if (isVisibilityAllowed(vis, minVisibility)) {
          filtered[key] = configData[key] ?? null;
        }
      }
    }

    return filtered;
  }

  return filterByVisibilityKeys(visibilityTree, config);
}

/**
 * Extract only public config fields using backend visibility metadata.
 *
 * @param config - Configuration object
 * @param visibility - Visibility metadata
 * @throws Error if visibility metadata is not provided
 */
export function filterPublicConfig(
  config: Record<string, any>,
  visibility: Record<string, any>
): Record<string, any> {
  if (!visibility || (typeof visibility === 'object' && Object.keys(visibility).length === 0)) {
    throw new Error('Visibility metadata required to filter public fields');
  }

  return filterConfigByVisibility(config, visibility, 'public');
}
