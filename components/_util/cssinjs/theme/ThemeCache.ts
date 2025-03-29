import type Theme from './Theme';
import type { DerivativeFunc } from './types';

// ================================== Cache ==================================
type ThemeCacheMap = Map<
  DerivativeFunc<any, any>,
  {
    map?: ThemeCacheMap;
    value?: [Theme<any, any>, number];
  }
>;

type DerivativeOptions = DerivativeFunc<any, any>[];

export function sameDerivativeOption(left: DerivativeOptions, right: DerivativeOptions) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 主题缓存管理类，用于存储和管理主题派生配置的缓存
 * 采用最近最少使用策略维护缓存数量，保证缓存数量在限制范围内
 */
export default class ThemeCache {
  /** 缓存最大容量限制 */
  public static MAX_CACHE_SIZE = 20;
  /** 缓存容量允许超过最大值的临时偏移量，减少频繁淘汰的开销 */
  public static MAX_CACHE_OFFSET = 5;
  private readonly cache: ThemeCacheMap;
  private keys: DerivativeOptions[];
  // cacheCallTimes越大 说明越是最近才访问
  private cacheCallTimes: number;

  /**
   * 初始化主题缓存实例
   * @param cache 缓存存储的Map结构
   * @param keys 当前存储的所有缓存键集合
   * @param cacheCallTimes 缓存访问计数器，用于实现LRU策略
   */
  constructor() {
    this.cache = new Map();
    this.keys = [];
    this.cacheCallTimes = 0;
  }

  /** 获取当前缓存数量 */
  public size(): number {
    return this.keys.length;
  }

  /**
   * 内部缓存获取方法，支持更新访问计数器
   * @param derivativeOption 主题派生配置数组
   * @param updateCallTimes 是否更新调用次数标记
   * @returns 返回包含[主题实例, 最后访问次数]的元组或undefined
   */
  private internalGet(
    derivativeOption: DerivativeOptions,
    updateCallTimes = false,
  ): [Theme<any, any>, number] | undefined {
    // 通过派生配置层级逐级查找缓存
    let cache: ReturnType<ThemeCacheMap['get']> = { map: this.cache };
    derivativeOption.forEach(derivative => {
      if (!cache) {
        cache = undefined;
      } else {
        cache = cache?.map?.get(derivative);
      }
    });

    // 更新最后访问次数
    if (cache?.value && updateCallTimes) {
      cache.value[1] = this.cacheCallTimes++;
    }
    return cache?.value;
  }

  /** 获取主题实例，同时更新其最后访问次数 */
  public get(derivativeOption: DerivativeOptions): Theme<any, any> | undefined {
    return this.internalGet(derivativeOption, true)?.[0];
  }

  /** 检查是否存在指定派生配置的缓存 */
  public has(derivativeOption: DerivativeOptions): boolean {
    return !!this.internalGet(derivativeOption);
  }

  /**
   * 设置主题缓存，当超过容量限制时执行缓存淘汰(**当超过容量上限时，移除最近最少使用的缓存**)
   * @param derivativeOption 主题派生配置数组
   * @param value 要缓存的主题实例
   */
  public set(derivativeOption: DerivativeOptions, value: Theme<any, any>): void {
    // 缓存淘汰策略：当超过容量上限时，移除最近最少使用的缓存
    if (!this.has(derivativeOption)) {
      if (this.size() + 1 > ThemeCache.MAX_CACHE_SIZE + ThemeCache.MAX_CACHE_OFFSET) {
        // 查找访问次数最早的缓存项
        const [targetKey] = this.keys.reduce<[DerivativeOptions, number]>(
          (result, key) => {
            const [, callTimes] = result;
            if (this.internalGet(key)![1] < callTimes) {
              return [key, this.internalGet(key)![1]];
            }
            return result;
          },
          [this.keys[0], this.cacheCallTimes],
        );
        this.delete(targetKey);
      }

      this.keys.push(derivativeOption);
    }

    // 层级式存储缓存结构
    let cache = this.cache;
    derivativeOption.forEach((derivative, index) => {
      if (index === derivativeOption.length - 1) {
        cache.set(derivative, { value: [value, this.cacheCallTimes++] });
      } else {
        const cacheValue = cache.get(derivative);
        if (!cacheValue) {
          // 为中间层级创建存储结构
          cache.set(derivative, { map: new Map() });
        } else if (!cacheValue.map) {
          cacheValue.map = new Map();
        }
        // 取到下一层缓存结构
        cache = cache.get(derivative)!.map!;
      }
    });
  }

  /**
   * 递归删除缓存路径
   * @param currentCache 当前层级的缓存Map
   * @param derivatives 待删除的派生函数数组
   * @returns 被删除的主题实例
   */
  private deleteByPath(
    currentCache: ThemeCacheMap,
    derivatives: DerivativeFunc<any, any>[],
  ): Theme<any, any> | undefined {
    const cache = currentCache.get(derivatives[0])!;
    // 到达路径末端时执行删除
    if (derivatives.length === 1) {
      if (!cache.map) {
        currentCache.delete(derivatives[0]);
      } else {
        currentCache.set(derivatives[0], { map: cache.map });
      }
      return cache.value?.[0];
    }

    // 递归处理子路径
    const result = this.deleteByPath(cache.map!, derivatives.slice(1));

    // 清理空节点
    if ((!cache.map || cache.map.size === 0) && !cache.value) {
      currentCache.delete(derivatives[0]);
    }
    return result;
  }

  /** 删除指定派生配置的缓存，返回被删除的主题实例 */
  public delete(derivativeOption: DerivativeOptions): Theme<any, any> | undefined {
    if (this.has(derivativeOption)) {
      this.keys = this.keys.filter(item => !sameDerivativeOption(item, derivativeOption));
      return this.deleteByPath(this.cache, derivativeOption);
    }
    return undefined;
  }
}

/*
基本用法
// 定义两个派生函数
const addPadding: DerivativeFunc = (theme) => ({ ...theme, padding: 10 });
const addColor: DerivativeFunc = (theme) => ({ ...theme, color: 'blue' });

// 生成主题实例
const baseTheme = new Theme({ fontSize: 14 });
const derivedTheme = baseTheme.derive(addPadding).derive(addColor);

// 缓存配置
const derivatives = [addPadding, addColor];
themeCache.set(derivatives, derivedTheme);

// 后续使用直接从缓存获取
const cachedTheme = themeCache.get(derivatives); // 命中缓存

*/

/*
// 层级存储示意图
对于 derivativeOption = [funcA, funcB], 缓存结构如下:
this.cache = Map {
  funcA => {
    map: Map {
      funcB => {
        value: [derivedTheme, 访问次序]
      }
    }
  }
}

*/

/*
// 新增缓存（触发 LRU 淘汰）
// 设置较小的 MAX_CACHE_SIZE 便于测试
ThemeCache.MAX_CACHE_SIZE = 2;
ThemeCache.MAX_CACHE_OFFSET = 1;

const themeCache = new ThemeCache();

// 添加 3 个缓存（超过 MAX_CACHE_SIZE + MAX_CACHE_OFFSET = 3）
themeCache.set([funcA], new Theme({})); // 缓存 1
themeCache.set([funcB], new Theme({})); // 缓存 2
themeCache.set([funcC], new Theme({})); // 缓存 3（触发淘汰）

// 此时缓存数量为 3，超过限制，触发淘汰
console.log(themeCache.size()); // 输出 3（临时允许超出）

// 再添加一个缓存，触发二次淘汰
themeCache.set([funcD], new Theme({})); // 缓存 4

// 最终缓存数量为 3（MAX_CACHE_SIZE + MAX_CACHE_OFFSET）
console.log(themeCache.size()); // 输出 3
// 最终缓存保留 [funcB]、[funcC]、[funcD]
*/

/*
// 覆盖已有缓存, 覆盖操作不会增加缓存数量，但会更新访问计数器。
const themeCache = new ThemeCache();

const derivatives = [funcA];
const themeOld = new Theme({ color: "red" });
const themeNew = new Theme({ color: "blue" });

// 第一次存储
themeCache.set(derivatives, themeOld);
console.log(themeCache.get(derivatives) === themeOld); // true

// 覆盖存储
themeCache.set(derivatives, themeNew);
console.log(themeCache.get(derivatives) === themeNew); // true
console.log(themeCache.size()); // 输出 1（数量不变）
*/

/*
// 多层派生配置
const themeCache = new ThemeCache();

// 定义多层派生配置
const multiLevelDerivatives = [funcA, funcB, funcC];
const theme = new Theme({ color: "green" });

// 存储缓存
themeCache.set(multiLevelDerivatives, theme);

// 检查缓存结构
const cacheA = themeCache.cache.get(funcA);
const cacheB = cacheA?.map?.get(funcB);
const cacheC = cacheB?.map?.get(funcC);

console.log(cacheC?.value?.[0] === theme); // true

// 结构
cache
└── funcA
    └── map
        └── funcB
            └── map
                └── funcC
                    └── value: [theme, 访问次序]
*/
