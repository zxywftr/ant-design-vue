import type { Linter } from './types';
import { lintWarning } from './utils';

/**
 * CSS 属性值校验函数
 *
 * @param key - 当前需要校验的 CSS 属性名称
 * @param value - 对应的 CSS 属性值
 * @param info - 包含上下文信息的对象（包含 hashId 等元数据）
 * @returns void 无返回值，通过调用 lintWarning 发出警告
 */
const linter: Linter = (key, value, info) => {
  // 针对 animation 属性的特殊校验规则
  if (key === 'animation') {
    /**
     * 当检测到使用哈希化的动画且值不为 none 时
     * 建议改用 animationName 配合 Keyframe 的写法
     */
    if (info.hashId && value !== 'none') {
      lintWarning(
        `You seem to be using hashed animation '${value}', in which case 'animationName' with Keyframe as value is recommended.`,
        info,
      );
    }
  }
};

export default linter;
