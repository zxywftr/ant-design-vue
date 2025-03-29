import Theme from './Theme';
import ThemeCache from './ThemeCache';
import type { DerivativeFunc, TokenType } from './types';

const cacheThemes = new ThemeCache();

/**
 * 创建或获取缓存中的主题实例
 * Same as new Theme, but will always return same one if `derivative` not changed.
 * @template DesignToken 基础设计令牌类型，需继承自TokenType
 * @template DerivativeToken 衍生设计令牌类型，需继承自TokenType
 * @param {DerivativeFunc<DesignToken, DerivativeToken>[] | DerivativeFunc<DesignToken, DerivativeToken>} derivatives
 * 衍生函数配置，可接受单个衍生函数或函数数组。每个衍生函数用于根据基础令牌生成衍生令牌
 * @returns {Theme} 返回缓存中对应的主题实例。当多次调用相同配置时会复用已有实例
 */
export default function createTheme<
  DesignToken extends TokenType,
  DerivativeToken extends TokenType,
>(
  derivatives:
    | DerivativeFunc<DesignToken, DerivativeToken>[]
    | DerivativeFunc<DesignToken, DerivativeToken>,
) {
  // 统一处理参数为数组格式，适配单个函数参数的调用方式
  const derivativeArr = Array.isArray(derivatives) ? derivatives : [derivatives];

  // 缓存处理逻辑：未命中时创建新主题并缓存
  if (!cacheThemes.has(derivativeArr)) {
    cacheThemes.set(derivativeArr, new Theme(derivativeArr));
  }

  // 从缓存中获取已存在的主题实例（非空断言符保证此处必有值）
  return cacheThemes.get(derivativeArr)!;
}
