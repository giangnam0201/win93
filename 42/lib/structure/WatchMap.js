import { Emittable } from "../class/mixin/Emittable.js"

const EmittableMap = Emittable(Map)

/**
 * @template {any} K
 * @template {any} V
 * @extends {EmittableMap<K, V>}
 */
export class WatchMap extends EmittableMap {
  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    this.emit("add", value, key)
    super.set(key, value)
    this.emit("change", { type: "add", key, value })
    return this
  }

  /** @param {K} key */
  delete(key) {
    if (super.has(key) === false) return false
    this.emit("delete", key)
    super.delete(key)
    this.emit("change", { type: "delete", key })
    return true
  }

  clear() {
    this.emit("clear")
    super.clear()
    this.emit("change", { type: "clear" })
  }

  /**
   * @param {K} key
   * @param {V} value
   */
  setSilent(key, value) {
    return super.set(key, value)
  }

  /** @param {K} key */
  deleteSilent(key) {
    return super.delete(key)
  }

  clearSilent() {
    return super.clear()
  }
}
