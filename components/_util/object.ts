const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (val: object, key: PropertyKey) => hasOwnProperty.call(val, key);
const keysOf = <T extends object>(obj: T) => Object.keys(obj) as (keyof T)[];

export { hasOwn, keysOf };
