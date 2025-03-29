export const isFunction = (val: unknown) => typeof val === 'function';
export const isArray = Array.isArray;
export const isString = (val: unknown) => typeof val === 'string';
export const isSymbol = (val: unknown) => typeof val === 'symbol';
export const isObject = (val: unknown) => val !== null && typeof val === 'object';

const onRE = /^on[^a-z]/;
export const isOn = (key: string) => onRE.test(key);

export const isValid = (value: any): boolean => {
  return value !== undefined && value !== null && value !== '';
};
