import type { Linter } from '..';
import { lintWarning } from './utils';

/**
 * Linter function for validating CSS selector syntax rules
 * Linter for checking & (嵌套选择器)
 * @param _key - Unused parameter (presumably related to CSS property key)
 * @param _value - Unused parameter (presumably related to CSS property value)
 * @param info - Object containing linting context information including parent selectors
 * @returns void
 */
const linter: Linter = (_key, _value, info) => {
  // Validate parent selectors don't contain multiple `&` in single selector segment
  if (
    info.parentSelectors.some(selector => {
      // Split compound selectors and check each individual selector
      const selectors = selector.split(',');
      return selectors.some(item => item.split('&').length > 2);
    })
  ) {
    // Warn when complex nesting pattern detected
    lintWarning('Should not use more than one `&` in a selector.', info);
  }
};

export default linter;
