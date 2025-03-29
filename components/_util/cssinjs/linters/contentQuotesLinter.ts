import type { Linter } from './types';
import { lintWarning } from './utils';

/**
 * CSS属性值校验函数，主要用于检查'content'属性的使用规范
 *
 * @param key - 需要校验的CSS属性名称
 * @param value - 对应的CSS属性值
 * @param info - 包含上下文信息的对象，用于生成警告时的定位信息
 * @returns void
 */
const linter: Linter = (key, value, info) => {
  if (key === 'content') {
    // 匹配emotion库定义的合法content值模式（包含CSS函数和特殊关键字）
    const contentValuePattern =
      /(attr|counters?|url|(((repeating-)?(linear|radial))|conic)-gradient)\(|(no-)?(open|close)-quote/;
    // 允许直接使用的预设值列表
    const contentValues = ['normal', 'none', 'initial', 'inherit', 'unset'];

    /**
     * 复合校验逻辑：
     * 1. 值类型必须为字符串
     * 2. 不在预设白名单 且
     * 3. 不匹配合法函数模式 且
     * 4. 没有正确使用引号包裹
     */
    if (
      typeof value !== 'string' ||
      (contentValues.indexOf(value) === -1 &&
        !contentValuePattern.test(value) &&
        (value.charAt(0) !== value.charAt(value.length - 1) ||
          (value.charAt(0) !== '"' && value.charAt(0) !== "'")))
    ) {
      lintWarning(
        `You seem to be using a value for 'content' without quotes, try replacing it with \`content: '"${value}"'\`.`,
        info,
      );
    }
  }
};

export default linter;
