// http://stackoverflow.com/a/34749873/1289275

const { propertyIsEnumerable } = Object.prototype;

export default function extend(target, ...sources) {
  let obj;
  function eachOwnKey(key) {
    if (propertyIsEnumerable.call(obj, key)) {
      const val = obj[key];
      if (Array.isArray(val)) {
        target[key] = val.map(
          x =>
            x && typeof x === "object" && !(x instanceof Node)
              ? extend(Array.isArray(x) ? [] : {}, x)
              : x
        );
      } else if (val && typeof val === "object") {
        target[key] =
          target[key] && typeof target[key] === "object" ? target[key] : {};
        extend(target[key], val);
      } else target[key] = val;
    }
  }
  for (let i = 0, l = sources.length; i < l; i++) {
    obj = sources[i];
    if (obj && typeof obj === "object")
      Reflect.ownKeys(obj).forEach(eachOwnKey);
  }
  return target;
}
