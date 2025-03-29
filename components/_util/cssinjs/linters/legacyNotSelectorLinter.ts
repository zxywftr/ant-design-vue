import type { Linter, LinterInfo } from './types';
import { lintWarning } from './utils';

/**
 * 判断给定选择器是否为使用反选伪类且是组合选择器
 * @param selector - 需要解析的CSS选择器字符串
 * @returns 当选择器包含多个简单选择器组合时返回true，否则返回false
 */
function isConcatSelector(selector: string) {
  // 提取:not()伪类中的参数内容，若不存在则返回空字符串s
  const notContent = selector.match(/:not\(([^)]*)\)/)?.[1] || '';

  // 使用正则表达式分割选择器为原子单元：
  // 1. 保留完整的属性选择器（[...]结构）
  // 2. 在类选择器（.）或ID选择器（#）前进行分割
  // 示例结果：'h1#a.b' → ['h1', '#a', '.b']
  const splitCells = notContent.split(/(\[[^[]*])|(?=[.#])/).filter(str => str);

  // 当分割后的原子单元超过1个时，判定为反选伪类且是组合选择器
  return splitCells.length > 1;
}

/**
 * 解析父选择器路径，生成最终选择器字符串
 *
 * @param info 包含父选择器信息的Linter对象
 *   - parentSelectors: 父选择器数组，用于层级组合
 * @returns 生成完整的选择器路径字符串
 */
function parsePath(info: LinterInfo) {
  // 通过reduce迭代处理父选择器数组，逐步构建最终选择器
  return info.parentSelectors.reduce((prev, cur) => {
    if (!prev) {
      return cur;
    }

    /*
     * 当前选择器包含嵌套标识符(&)时：
     * - 将 & 替换为前序选择器路径
     * 不包含嵌套标识符时：
     * - 将当前选择器追加到前序路径后侧形成层级关系
     */
    return cur.includes('&') ? cur.replace(/&/g, prev) : `${prev} ${cur}`;
  }, ''); // 初始值为空字符串，用于处理首个选择器
}

/**
 * Linter function for detecting legacy browser unsupported :not selector usage
 *
 * @param _key - 未使用的样式键参数（可能为样式规则属性名）
 * @param _value - 未使用的样式值参数（可能为样式规则属性值）
 * @param info - 包含上下文信息的对象（提供选择器路径等校验需要的数据）
 * @returns 无返回值
 */
const linter: Linter = (_key, _value, info) => {
  // 解析父选择器路径并匹配所有:not伪类选择器
  const parentSelectorPath = parsePath(info);
  const notList = parentSelectorPath.match(/:not\([^)]*\)/g) || [];

  /**
   * 检测包含拼接选择器的:not表达式（旧版浏览器兼容性检查）
   * 这个条件组合需要同时满足两个条件才会触发警告，原因在于：
   * notList.length > 0 的作用：
   *  仅确保存在至少一个:not()伪类选择器
   *  但无法判断这些:not()的内容是否符合警告条件
   * notList.some(isConcatSelector) 的作用：
   *  进一步检测这些:not()中是否包含旧浏览器不支持的组合选择器写法
   *  例如：:not(.a.b)会被识别为组合选择器，而:not(.a)则不会
   * 这种设计是为了精确匹配以下两种情况同时存在时才警告： 存在:not()选择器且其中包含旧浏览器不支持的组合语法
   */
  if (notList.length > 0 && notList.some(isConcatSelector)) {
    lintWarning(`Concat ':not' selector not support in legacy browsers.`, info);
  }
};

export default linter;
