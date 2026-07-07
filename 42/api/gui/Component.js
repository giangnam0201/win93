/* eslint-disable max-depth */
// import { Reactive } from "./Reactive.js"
import { render, toPlanObject, isPlanObject } from "./render.js"
import { toKebabCase } from "../../lib/type/string/transform.js"
import { configure } from "../configure.js"
import { Canceller } from "../../lib/class/Canceller.js"
import { uid } from "../uid.js"
import { defer } from "../../lib/type/promise/defer.js"

/**
 * @typedef {import("./render.js").Plan} Plan
 * @typedef {import("./render.js").PlanObject} PlanObject
 * @typedef {new (...args: any[]) => {}} Constructable
 *
 * @typedef {PlanObject & {
 *   props?: Record<string, any>
 * }} PlanComponent
 *
 * @typedef {{
 *   new (...args: any[]): Component
 *   prototype: Component
 *   plan?: Plan
 *   observedAttributes?: string[]
 * }} ComponentConstructor
 */

function getTagFromComponentClass(Class) {
  if (Class.name === "Class") throw new Error(`missing Component "tag"`)
  return `ui-${toKebabCase(Class.name)}`
}

const notDefineds = new WeakSet()

export class Component extends HTMLElement {
  #isComponent = true
  static isComponent(val) {
    return val && typeof val === "object" ? #isComponent in val : false
  }

  #cancel
  renderReady
  isRendered
  #props

  /**
   * @template {Constructable} T
   * @param {T} Class
   * @returns {(...args: ConstructorParameters<T>) => InstanceType<T>}
   */
  static define(Class) {
    if (typeof Class !== "function") {
      Class = class extends Component {
        static plan = /** @type {PlanComponent} */ (Class)
      }
    }

    let tag
    let props
    if (isPlanObject(Class.plan)) {
      tag = Class.plan.tag
      props = Class.plan.props
    }

    tag ??= getTagFromComponentClass(Class)

    const factory = (...args) => new Class(...args)

    if (customElements.get(tag)) return factory

    if (props) {
      Class.observedAttributes ??= []
      for (const [key, item] of Object.entries(props)) {
        Class.observedAttributes.push(item.attribute ?? toKebabCase(key))
      }
    }

    for (const el of document.querySelectorAll(tag)) {
      notDefineds.add(el)
    }

    customElements.define(tag, Class)
    return factory
  }

  /**
   * @param {Plan} [plan]
   */
  constructor(plan) {
    super()

    const { signal, cancel } = new Canceller()
    this.signal = signal
    this.#cancel = cancel

    // this.reactive = new Reactive({ signal })
    this.ready = defer()

    this.config = {}
    this.skipRender = {}

    // @ts-ignore
    const constructorPlan = this.constructor.plan

    const { skipRender } = constructorPlan
    if (skipRender?.length) {
      for (const key of skipRender) {
        this.skipRender[key] = undefined
      }
    }

    this.plan = configure(
      toPlanObject(constructorPlan), //
      toPlanObject(plan),
    )

    if (this.plan.options) this.config = this.plan.options

    this.plan.signal?.addEventListener("abort", () => this.destroy())
    delete this.plan.signal

    delete this.plan.tag
    delete this.plan.options
    delete this.plan.skipRender

    this.#props = this.plan.props
    delete this.plan.props

    this.stage = {
      isRoot: true,
      isComponent: true,
      signal: this.signal,
      // reactive: this.reactive,
    }

    this.constructed()
  }

  async init() {
    if (this.hasAttribute("data-no-render")) return

    if (notDefineds.has(this) && this.#props) {
      notDefineds.delete(this)

      // Element was connected before the Component was defined so we set props from attributes
      for (const { name, value } of this.attributes) {
        if (name in this.#props) {
          const prop = this.#props[name]
          if (prop === true) {
            const type = typeof this[name]
            switch (type) {
              case "string":
                this[name] = value
                break

              case "boolean":
                this[name] = true
                break

              default:
            }
          }
        }
      }
    }

    if (this.plan.id) {
      this.id ||= this.plan.id === true ? uid() : this.plan.id
      delete this.plan.id
    }

    render(
      {
        ...this.plan,
        ...this.skipRender,
      },
      this,
      this.stage,
    )

    this.inited()

    const res = await this.rerender({ silent: true, init: true })
    await this.created()
    this.ready.resolve()
    this.isRendered = true

    if (res !== false) {
      this.dispatchEvent(new CustomEvent("ui.render"))
      await this.rendered()
    }
  }

  async rerender(options) {
    if (this.signal.aborted) return false
    if (!this.isConnected && !this.isRendered) return false

    if (options?.init !== true && this.renderReady?.isPending) {
      this.renderCancel.resolve(false)
      this.renderCancel = defer()
    }

    const plan = await Promise.race([
      this.renderCancel,
      this.render(this.plan, this.renderCancel),
    ])

    if (plan === false) return false

    if (plan !== undefined) {
      this.replaceChildren()
      render(plan, this, this.stage)
    }

    this.renderReady.resolve()
    this.renderReady = defer()

    if (options?.silent !== true) {
      this.dispatchEvent(new CustomEvent("ui.render"))
      await this.rendered()
    }
  }

  attributeChangedCallback(key, prev, changedVal) {
    if (this.signal.aborted) return
    if (this.renderReady?.isPending && !this.isRendered) return
    const val = key in this ? this[key] : changedVal
    this.updated(key, val, prev, changedVal)
  }

  connectedCallback() {
    if (!this.isRendered) {
      this.renderReady = defer()
      this.renderCancel = defer()
      this.init?.()
    }

    this.connected?.()
  }

  #abortType = "destroyed"
  disconnectedCallback() {
    this.disconnected?.()

    // Destroy the element if not transfered
    requestIdleCallback(
      () => {
        if (!this.isConnected) {
          this.#abortType = "disconnected"
          this.destroy?.()
        }
      },
      { timeout: 3000 },
    )
  }

  adoptedCallback() {
    this.toggleAttribute("data-no-render", true)
  }

  abort() {
    this.#cancel(`Component ${this.localName} aborted`)
  }

  destroy() {
    this.#cancel(`Component ${this.localName} ${this.#abortType}`)
    const res = this.destroyed()
    // @ts-ignore
    if (res !== false) this.remove()
  }

  // Lifecycle
  constructed() {}
  inited() {}

  render(_plan, _cancel) {}

  created() {}
  rendered() {}
  connected() {}

  updated(_key, _val, _prev, _changedVal) {}

  disconnected() {}
  destroyed() {}
}
