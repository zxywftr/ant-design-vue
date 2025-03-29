import type { Linter } from './types';
import { lintWarning } from './utils';

/**
 * CSS属性检查器，用于检测样式属性是否符合RTL（从右到左）布局模式的逻辑属性规范
 * @param key - 需要检查的CSS属性名称
 * @param value - 对应属性的赋值内容，可能是字符串或数值类型
 * @param info - 包含上下文信息的对象，用于错误定位和提示
 * @returns void 无返回值，通过lintWarning函数输出警告
 */
const linter: Linter = (key, value, info) => {
  switch (key) {
    // 检测明确的物理方向属性（left/right相关）
    case 'marginLeft':
    // ...其他物理属性case...
    case 'borderBottomRightRadius':
      lintWarning(
        `You seem to be using non-logical property '${key}' which is not compatible with RTL mode. Please use logical properties and values instead. For more information: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties.`,
        info,
      );
      return;

    // 处理复合属性值中的左右不对称情况
    case 'margin':
    case 'padding':
    case 'borderWidth':
    case 'borderStyle':
      if (typeof value === 'string') {
        const valueArr = value.split(' ').map(item => item.trim());
        // 检测四值简写中左右值是否不一致（如：margin: 1px 2px 3px 4px）
        if (valueArr.length === 4 && valueArr[1] !== valueArr[3]) {
          lintWarning(
            `You seem to be using '${key}' property with different left ${key} and right ${key}, which is not compatible with RTL mode. Please use logical properties and values instead. For more information: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties.`,
            info,
          );
        }
      }
      return;

    // 检测文本方向相关属性值
    case 'clear':
    case 'textAlign':
      if (value === 'left' || value === 'right') {
        lintWarning(
          `You seem to be using non-logical value '${value}' of ${key}, which is not compatible with RTL mode. Please use logical properties and values instead. For more information: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties.`,
          info,
        );
      }
      return;

    // 复杂边界半径检测逻辑
    case 'borderRadius':
      if (typeof value === 'string') {
        const radiusGroups = value.split('/').map(item => item.trim());
        const invalid = radiusGroups.reduce((result, group) => {
          const radiusArr = group.split(' ').map(item => item.trim());
          // 检测各种可能的不对称半径配置：
          // 1. 基本两值不对称（如：2px 4px）
          // 2. 三值配置中后两值不对称（如：4px 4px 2px）
          // 3. 四值配置中后两值不对称（如：4px 4px 2px 4px）
          return (
            result ||
            (radiusArr.length >= 2 && radiusArr[0] !== radiusArr[1]) ||
            (radiusArr.length === 3 && radiusArr[1] !== radiusArr[2]) ||
            (radiusArr.length === 4 && radiusArr[2] !== radiusArr[3])
          );
        }, false);

        if (invalid) {
          lintWarning(
            `You seem to be using non-logical value '${value}' of ${key}, which is not compatible with RTL mode. Please use logical properties and values instead. For more information: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties.`,
            info,
          );
        }
      }
      return;

    default:
  }
};

export default linter;
