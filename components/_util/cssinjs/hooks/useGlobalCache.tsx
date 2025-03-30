import type { Ref, ShallowRef } from 'vue';
import { onBeforeUnmount, shallowRef, watch, watchEffect } from 'vue';
import type { CacheKeyType } from '../Cache';
import { useStyleInject } from '../StyleContext';
import useHMR from './useHMR';
/**
 * @description Client-side cache management hook for generating and maintaining style-related cache objects
 *
 * @template CacheType - Type of the cache object
 * @param prefix - Cache key prefix for differentiating cache types
 * @param cacheKeyArr - Reactive array of cache keys, changes will trigger cache updates
 * @param genCache - Cache generation function called when new cache is needed
 * @param onCacheRemove - Optional cache cleanup callback triggered during cache removal or HMR updates
 * @returns Shallow reactive reference to the current cache object
 */
export default function useClientCache<CacheType>(
  prefix: string,
  cacheKeyArr: Ref<CacheKeyType[]>,
  genCache: () => CacheType,
  onCacheRemove?: (cache: CacheType, fromHMR: boolean) => void,
): ShallowRef<CacheType> {
  const styleContext = useStyleInject();
  const cacheKeyCompleteness = shallowRef('');
  const cacheKey = shallowRef<CacheType>();

  // Watch for cache key changes to generate complete cache key
  watchEffect(() => {
    cacheKeyCompleteness.value = [prefix, ...cacheKeyArr.value].join('%');
  });

  const HMRUpdate = useHMR();

  // Cache cleanup logic maintaining reference count and triggering callback to remove cache at zero reference count.
  const clearCache = (cacheKeyCompleteness: string) => {
    styleContext.value.cache.update(cacheKeyCompleteness, prevCache => {
      const [times = 0, cache] = prevCache || [];
      const nextCount = times - 1;
      if (nextCount === 0) {
        onCacheRemove?.(cache, false);
        return null;
      }
      return [times - 1, cache];
    });
  };

  // Main watch logic: Update cache reference when cache key changes
  watch(
    cacheKeyCompleteness,
    (newStr, oldStr) => {
      if (oldStr) clearCache(oldStr);

      // Create/update cache while maintaining reference count
      styleContext.value.cache.update(newStr, prevCache => {
        const [times = 0, cache] = prevCache || [];
        let tmpCache = cache;

        // Handle cache reset during HMR updates in development
        if (process.env.NODE_ENV !== 'production' && cache && HMRUpdate) {
          onCacheRemove?.(tmpCache, HMRUpdate);
          tmpCache = null;
        }

        const mergedCache = tmpCache || genCache();
        return [times + 1, mergedCache];
      });

      cacheKey.value = styleContext.value.cache.get(cacheKeyCompleteness.value)![1];
    },
    { immediate: true },
  );

  // Clean up cache on component unmount
  onBeforeUnmount(() => {
    clearCache(cacheKeyCompleteness.value);
  });

  return cacheKey;
}
