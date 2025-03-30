import type { InjectionKey, PropType, Ref, ShallowRef } from 'vue';
import {
  defineComponent,
  getCurrentInstance,
  inject,
  provide,
  shallowRef,
  unref,
  watch,
} from 'vue';
import { keysOf } from '../object';
import { withInstall } from '../type';
import CacheEntity from './Cache';
import type { Linter } from './linters/types';
import type { Transformer } from './transformers/interface';
export const ATTR_TOKEN = 'data-token-hash';
export const ATTR_MARK = 'data-css-hash';
export const ATTR_CACHE_PATH = 'data-cache-path';

// Mark css-in-js instance in style element
export const CSS_IN_JS_INSTANCE = '__cssinjs_instance__';

/**
 * @description Create a cache instance with random cssinjsInstanceId.
 * Before creation, it will try to move all style elements to the `<head>` and ensure their uniqueness
 * @export
 * @returns CacheEntity
 */
export function createCache() {
  const cssinjsInstanceId = Math.random().toString(12).slice(2);

  // Tricky SSR: Move all inline style to the head.
  // PS: We do not recommend tricky mode.
  if (typeof document !== 'undefined' && document.head && document.body) {
    const styleElementsInBody = document.body.querySelectorAll(`style[${ATTR_MARK}]`) || [];
    const styleElementsInDocument = document.querySelectorAll(`style[${ATTR_MARK}]`) || [];
    const { firstChild } = document.head;
    console.log('StyleContext createCache', {
      firstChild,
      styleElementsInBody,
      styleElementsInDocument,
    });

    // Move all styleElementsInBody style to the head
    Array.from(styleElementsInBody).forEach(style => {
      (style as any)[CSS_IN_JS_INSTANCE] = (style as any)[CSS_IN_JS_INSTANCE] || cssinjsInstanceId;
      // Not force move if no head
      if ((style as any)[CSS_IN_JS_INSTANCE] === cssinjsInstanceId) {
        document.head.insertBefore(style, firstChild);
      }
    });

    // Deduplicate of moved style elements
    const styleElementHashRecord: Record<string, boolean> = {};
    Array.from(styleElementsInDocument).forEach(styleElement => {
      const hash = styleElement.getAttribute(ATTR_MARK)!;
      // when here are some styleElement elements with same value of attribute  ATTR_MARK
      if (styleElementHashRecord[hash]) {
        if ((styleElement as any)[CSS_IN_JS_INSTANCE] === cssinjsInstanceId) {
          styleElement.parentNode?.removeChild(styleElement);
        }
      } else {
        styleElementHashRecord[hash] = true;
      }
    });
  }

  return new CacheEntity(cssinjsInstanceId);
}

export type HashPriority = 'low' | 'high';

export interface StyleContextProps {
  autoClear?: boolean;
  /** @private Test only. Not work in production. */
  mock?: 'server' | 'client';
  /**
   * Only set when you need ssr to extract style on you own.
   * If not provided, it will auto create <style /> on the end of Provider in server side.
   */
  cache: CacheEntity;
  /** Tell children that this context is default generated context */
  defaultCache: boolean;
  /**
   * Use `:where` selector to reduce hashId css selector priority
   * Config `hashPriority` to `high` instead of default `low`, which will remove `:where` wrapper
   * hashPriority not support dynamic update, you can reload for new value
   */
  hashPriority?: HashPriority;
  /** Tell cssinjs where to inject style in */
  container?: Element | ShadowRoot;
  /** Component wil render inline  `<style />` for fallback in SSR. Not recommend. */
  ssrInline?: boolean;
  /** Transform css before inject in document.
   * If you need to be compatible with older browsers, you can configure transformers through the StyleProvider of @ant-design/cssinjs
   * Please note that `transformers` do not support dynamic update
   */
  transformers?: Transformer[];
  /**
   * Linters to lint css before inject in document.
   * Styles will be linted after transforming.
   * Please note that `linters` do not support dynamic update.
   */
  linters?: Linter[];
}

const StyleContextKey: InjectionKey<ShallowRef<Partial<StyleContextProps>>> =
  Symbol('StyleContextKey');

export type UseStyleProviderProps = Partial<StyleContextProps> | Ref<Partial<StyleContextProps>>;

/**
 * @description Retrieves the CSS-in-JS cache entity for the current application instance.
 * If the cache entity already exists in the global properties of the application context, it is returned directly.
 * If not, a new cache entity is created and attached to the global properties of the application context.
 * @see {@link https://github.com/vueComponent/ant-design-vue/issues/7023|issues/7023}
 * @returns {CacheEntity} The CSS-in-JS cache entity for the current application instance.
 */
const getAppContextStyleCache = (): CacheEntity => {
  const instance = getCurrentInstance();
  let cache: CacheEntity;

  // Check if the current instance and its application context exist
  if (instance && instance.appContext) {
    const globalCache = instance.appContext?.config?.globalProperties?.__ANTDV_CSSINJS_CACHE__;

    // If a global cache exists, use it directly
    if (globalCache) {
      cache = globalCache;
    } else {
      // Otherwise, create a new cache entity and attach it to the global properties
      cache = createCache();
      if (instance.appContext.config.globalProperties) {
        // Ensure only one cache entity exists per application context
        instance.appContext.config.globalProperties.__ANTDV_CSSINJS_CACHE__ = cache;
      }
    }
  } else {
    // If no instance or application context is available, create a new cache entity
    cache = createCache();
  }
  return cache;
};

const defaultStyleContext: StyleContextProps = {
  cache: createCache(),
  defaultCache: true,
  hashPriority: 'low',
};
// fix: https://github.com/vueComponent/ant-design-vue/issues/6912

/**
 * @description Hook for injecting styles into the Vue component.
 * This function is used to inject the style context into a Vue component and returns a shallow reference containing the default style context and a cache object.
 * @see {@link https://github.com/vueComponent/ant-design-vue/issues/6912|issues/6912}
 * @returns {ShallowRef<Partial<StyleContextProps>>} Returns a shallow reference containing the default style context and a cache object.
 * This reference can be accessed in the component via the `inject` method and is used to manage the global state of styles.
 */
export const useStyleInject = (): ShallowRef<Partial<StyleContextProps>> => {
  // Retrieve the style cache from the application context
  const appContextStyleCache = getAppContextStyleCache();

  // Inject the style context and return a shallow reference containing the default style context and the cache object
  return inject(
    StyleContextKey,
    shallowRef({
      ...defaultStyleContext,
      // https://github.com/vueComponent/ant-design-vue/issues/6912
      cache: appContextStyleCache,
    }),
  );
};

/**
 * @description Provides a style context for Vue components.
 * This function merges the provided props with the parent context and creates a new context object.
 * It then provides this context to child components via the `provide` function.
 *
 * @param {UseStyleProviderProps} props - The properties that define the style context.
 * @returns {ShallowRef<Partial<StyleContextProps>>} A shallow reference to the merged style context.
 */
export const useStyleProvider = (props: UseStyleProviderProps) => {
  // Retrieve the parent context using the `useStyleInject` hook.
  const parentContext = useStyleInject();

  // Create a shallow reference for the current context, initializing it with default values and a new cache.
  const context = shallowRef<Partial<StyleContextProps>>({
    ...defaultStyleContext,
    // https://github.com/vueComponent/ant-design-vue/issues/6912
    cache: createCache(),
  });

  // Watch for changes in the provided props and parent context.
  watch(
    [() => unref(props), parentContext],
    () => {
      // Merge the parent context with the provided props.
      const mergedContext: any = {
        ...parentContext.value,
      };
      const propsValue = unref(props);
      keysOf(propsValue).forEach(key => {
        const value = propsValue[key];
        if (value !== undefined) {
          mergedContext[key] = value;
        }
      });

      // Update the cache and defaultCache properties based on the provided props.
      const { cache } = propsValue;
      mergedContext.cache = mergedContext.cache || createCache();
      mergedContext.defaultCache = !cache && parentContext.value.defaultCache;

      // Update the current context with the merged context.
      context.value = mergedContext;
    },
    { immediate: true },
  );

  // Provide the current context to child components.
  provide(StyleContextKey, context);

  // Return the current context.
  return context;
};
// =========================== Style Provider ===========================
export type StyleProviderProps = StyleContextProps;

/**
 * @description Provide StyleContext in the form of component.
 * StyleProvider is a higher-order component that provides style management capabilities.
 * It is wrapped with `withInstall` to ensure it can be globally installed in a Vue application.
 * The component is defined using `defineComponent` and utilizes `useStyleProvider` to handle style-related logic.
 *
 * @param {Object} props - The props passed to the component.
 * @param {boolean} props.autoClear - Whether to automatically clear styles when the component is unmounted.
 * @param {string} props.mock - Specifies the mock environment, either 'server' or 'client'.
 * @param {Object} props.cache - The cache entity to be used for style management.
 * @param {boolean} props.defaultCache - Whether to use the default cache.
 * @param {string} props.hashPriority - The priority of the hash used in style generation.
 * @param {Object} props.container - The container element or shadow root where styles will be applied.
 * @param {boolean} props.ssrInline - Whether to inline styles for server-side rendering.
 * @param {Array} props.transformers - An array of style transformers to be applied.
 * @param {Array} props.linters - An array of style linters to be applied.
 * @param {Object} slots - The slots provided to the component.
 * @param {Function} slots.default - The default slot content to be rendered.
 *
 * @returns {Function} A render function that returns the default slot content.
 */
export const StyleProvider = withInstall(
  defineComponent(
    (props, { slots }) => {
      // Initialize style provider with the given props
      useStyleProvider(props);

      // Render the default slot content
      return () => slots.default?.();
    },
    {
      name: 'AStyleProvider',
      inheritAttrs: false,
      props: {
        autoClear: Boolean,
        mock: String as PropType<'server' | 'client'>,
        cache: Object as PropType<CacheEntity>,
        defaultCache: Boolean,
        hashPriority: String as PropType<HashPriority>,
        container: Object as PropType<Element | ShadowRoot>,
        ssrInline: Boolean,
        transformers: Array as PropType<Transformer[]>,
        linters: Array as PropType<Linter[]>,
      },
    },
  ),
);

export default {
  useStyleInject,
  useStyleProvider,
  StyleProvider,
};
