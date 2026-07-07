import { Emittable } from "../class/mixin/Emittable.js"

const EmittableSet = Emittable(Set)

/**
 * @template {any} V
 * @extends {EmittableSet<V>}
 */
export class WatchSet extends EmittableSet {
  /** @param {V} value */
  add(value) {
    this.emit("add", value)
    super.add(value)
    this.emit("change", { type: "add", key: value, value })
    return this
  }

  /** @param {V} value */
  delete(value) {
    if (super.has(value) === false) return false
    this.emit("delete", value)
    super.delete(value)
    this.emit("change", { type: "delete", key: value, value })
    return true
  }

  clear() {
    this.emit("clear")
    super.clear()
    this.emit("change", { type: "clear" })
  }

  /** @param {V} value */
  addSilent(value) {
    return super.add(value)
  }

  /** @param {V} value */
  deleteSilent(value) {
    return super.delete(value)
  }

  clearSilent() {
    return super.clear()
  }
}
