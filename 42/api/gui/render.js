/* eslint-disable unicorn/prefer-includes */
/* eslint-disable max-depth */
/* eslint-disable complexity */
import { create } from "./create.js"
import { renderAttributes } from "./render/renderAttributes.js"
import { renderText } from "./render/renderText.js"
import { renderButtonMenu } from "./render/renderButtonMenu.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { toTitleCase } from "../../lib/type/string/transform.js"
import { isHashmapLike } from "../../lib/type/any/isHashmapLike.js"
import { bindAudioParam } from "../../lib/audio/bindAudioParam.js"
import { renamable as renamableTrait } from "./trait/renamable.js"
import { on, stopEvent } from "../../lib/event/on.js"
import { uid } from "../uid.js"

const TEXTBOX_TYPES = new Set(["text", "email", "search"])

function isTextBox(el) {
  const { localName } = el
  return (
    localName === "textarea" ||
    (localName === "input" &&
      // @ts-ignore
      TEXTBOX_TYPES.has(el.type))
  )
}

/**
 * @typedef {any} Stage
 *
 * @typedef {{before?: string; after?: string;}} PlanPictoObject
 * @typedef {string | PlanPictoObject | Promise<PlanPictoObject>} PlanPicto
 * @typedef {() => Plan} PlanGenerator
 * @typedef {Plan[]} PlanArray
 * @typedef {Promise<Plan>} PlanPromise
 * @typedef {string} PlanPrimitive
 * @typedef {{
 *   tag?: string
 *   label?: Plan
 *   content?: Plan
 *   text?: string
 *   state?: any
 *   computed?: any
 *   picto?: PlanPicto
 *   box?: PlanObject
 *   if?: any
 *   on?: any
 *   action?: Function
 *   animation?: any
 *   range?: string
 *   fragment?: boolean
 *   bind?: string | AudioParam
 *   created?: (el: HTMLElement | SVGElement, data: any) => void
 *   [key: string]: any
 * }} PlanObject
 * @typedef {void | Node | PlanPrimitive | PlanObject | PlanArray | PlanGenerator} Plan
 */

/**
 * @param {Plan} [plan]
 * @returns {plan is PlanObject}
 */
export function isPlanObject(plan) {
  return (
    plan != null &&
    typeof plan === "object" &&
    !Array.isArray(plan) &&
    !isInstanceOf(plan, Node)
  )
}

/**
 * @param {Plan} [plan]
 * @param {string} [key]
 * @returns {PlanObject}
 */
export function toPlanObject(plan, key = "content") {
  return isPlanObject(plan) ? plan : plan == null ? {} : { [key]: plan }
}

/**
 * @param {Plan} [plan]
 */
export function toPlanString(plan) {
  if (typeof plan === "string") return plan
  const div = document.createElement("div")
  render(plan, div)
  return div.textContent
}

/**
 * @param {PlanPicto} picto
 * @param {Plan} content
 * @returns {Plan}
 */
function insertPicto(picto, content) {
  picto = /** @type {PlanPictoObject} */ (
    isHashmapLike(picto) ? picto : { before: picto }
  )

  if (content) {
    const next = []
    if (picto.before) next.push({ tag: "ui-picto", value: picto.before })
    if (Array.isArray(content)) next.push(...content)
    else next.push(content)
    if (picto.after) next.push({ tag: "ui-picto", value: picto.after })
    content = next
  } else {
    content = { tag: "ui-picto", value: picto.before ?? picto.after }
  }

  return content
}

function cloneStage(stage, options) {
  return { ...stage, isComponent: false, ...options }
}

/**
 * @param {PlanObject} box
 * @param {string} type
 * @param {Stage} [stage]
 */
function getBoxContainer(box, type, stage) {
  const out = render(box, undefined, cloneStage(stage, { isRoot: false }))

  if (typeof box.class !== "string") {
    if (type) {
      out.classList.toggle("control-box", true)
      out.classList.toggle(`control-box--${type}`, true)
    } else {
      out.classList.toggle("box", true)
    }
  }

  return out
}

/**
 * @template {PlanObject} T
 * @param {T} plan
 * @returns {T}
 */
export function ensurePlanEventMap(plan) {
  if (!plan.on) plan.on = []
  else if (!Array.isArray(plan.on)) plan.on = [plan.on]
  return plan
}

/**
 * @param {HTMLElement} el
 * @param {any} eventMap
 * @param {AbortSignal} [signal]
 */
export function renderEventMap(el, eventMap, signal) {
  const events = Array.isArray(eventMap) ? eventMap : [eventMap]
  on({ signal }, el, ...events)
}

/**
 * @overload
 * @param {Plan} plan
 * @param {HTMLElement} [el]
 * @param {Stage} [stage]
 * @returns {HTMLElement}
 */
/**
 * @overload
 * @param {PlanArray} plan
 * @param {undefined} [el]
 * @param {Stage} [stage]
 * @returns {DocumentFragment}
 */
/**
 * @param {Plan} plan
 * @param {HTMLElement} [el]
 * @param {Stage} [stage]
 * @returns {DocumentFragment | HTMLElement}
 */
export function render(plan, el, stage) {
  // MARK: String
  if (typeof plan === "string") return renderText(el, plan /* , stage */)
  if (typeof plan === "number") return renderText(el, String(plan))
  if (!plan) return
  if (typeof plan === "function") return render(plan(), el, stage)

  // MARK: Node
  if (isInstanceOf(plan, Node)) {
    el.append(plan)
    return el
  }

  // MARK: Array
  if (Array.isArray(plan)) {
    const localName = el?.localName
    const out = /** @type {HTMLElement} */ (
      el ?? document.createDocumentFragment()
    )

    if (localName === "table") {
      for (const item of /** @type {any[]} */ (plan)) {
        if (item == null) continue
        const trEl = document.createElement("tr")
        render(item, trEl, stage)
        out.append(trEl)
      }
    } else if (localName === "tr" || localName === "th") {
      for (let item of /** @type {any[]} */ (plan)) {
        if (item == null) continue
        if (
          isPlanObject(item) &&
          (item.tag?.startsWith("td") || item.tag?.startsWith("th"))
        ) {
          render(item, out, stage)
        } else {
          const tdEl = document.createElement("td")
          if (typeof item === "string" || typeof item === "number") {
            item = { tag: "span", content: item }
          }
          render(item, tdEl, stage)
          out.append(tdEl)
        }
      }
    } else if (
      localName === "select" ||
      localName === "optgroup" ||
      localName === "datalist"
    ) {
      const { value } = el.dataset
      for (let item of /** @type {any[]} */ (plan)) {
        if (typeof item === "string" || typeof item === "number") {
          const val = item
          item = new Option(String(val))
          if (val === "---") item.disabled = true
          if (item.value === value) item.selected = true
        } else if (Array.isArray(item)) {
          item = new Option(.../** @type {string[]} */ (item))
          if (item.value === value) item.selected = true
        } else if (!item) continue
        render(item, el, stage)
      }
    } else {
      for (const item of /** @type {any[]} */ (plan)) {
        render(item, out, stage)
      }
    }

    return out
  }

  // MARK: if
  if ("if" in plan && !plan.if) return

  let {
    tag,
    state,
    computed,
    label,
    list,
    content,
    text,
    fragment,
    box,
    picto,
    css,
    created,
    on,
    action,
    animation,
    menu,

    // traits
    position,
    positionable,
    movable,
    selectable,
    transferable,
    unrollable,
    renamable,

    plugins,

    if: ifKey,

    ...attrs
  } = plan

  // MARK: plugins
  if (plugins && stage) {
    stage.plugins ??= []
    stage.plugins.push(...[plugins].flat())
  }

  const traitOptions = {
    movable,
    positionable: position ?? positionable,
    selectable,
    transferable,
    unrollable,
    renamable,
  }

  let isComponent = false

  if (stage) {
    if (stage.reactive) {
      if (state) stage.reactive.addStateObject(state)
      if (computed) stage.reactive.addComputedObject(computed)
    }

    if (stage.isComponent) {
      isComponent = true
      stage.isComponent = false
    }
  }

  // MARK: el
  let frag
  /** @type {HTMLElement} */
  let parent
  if (stage?.isRoot && !tag) {
    stage.isRoot = false
  } else {
    parent = el

    if (fragment) {
      frag = document.createDocumentFragment()
      parent = /** @type {any} */ (frag)
    } else if (tag && tag.indexOf(">") !== -1) {
      if (!parent) {
        frag = document.createDocumentFragment()
        parent = /** @type {any} */ (frag)
      }
      const nesteds = tag.split(">")
      for (let i = 0, l = nesteds.length; i < l; i++) {
        const nested = nesteds[i].trim()
        const child = create(nested)
        if (i === l - 1) {
          el = child
        } else {
          parent.append(child)
          parent = child
        }
      }
    } else {
      el = create(tag)
    }
  }

  // MARK: picto
  if (picto) {
    if ("picto" in el) {
      el.picto = picto
    } else {
      if (
        !content &&
        !label &&
        !attrs.title &&
        !attrs.aria?.label &&
        !attrs.aria?.labelledby &&
        typeof picto === "string"
      ) {
        label = picto
      }

      content = insertPicto(picto, content)
    }
  }

  const { localName } = el

  // @ts-ignore
  const isControl = el.form !== undefined && localName !== "output"

  // MARK: Attributes
  // ----------------

  if (isControl) {
    if (isTextBox(el)) {
      attrs.autocomplete ??= "off" // opt-in autocomplete
      if (attrs.prose !== true) {
        attrs.autocapitalize ??= "none"
        attrs.autocorrect ??= "off"
        attrs.spellcheck ??= "false"
        attrs.translate ??= "no"
      }
    }

    if (attrs.range) {
      if (attrs.range === "fraction") {
        attrs.min ??= "0"
        attrs.max ??= "1"
        attrs.step ??= "0.01"
      }
    }

    if (attrs.bind && isInstanceOf(attrs.bind, AudioParam)) {
      bindAudioParam(/** @type {any} */ (el), attrs.bind, {
        signal: stage?.signal,
        ...attrs,
      })
      delete attrs.step
      delete attrs.min
      delete attrs.max
      delete attrs.value
      delete attrs.defaultValue
      delete attrs.scale
      delete attrs.unit
      delete attrs.watchAutomations
      delete attrs.transition
    }

    if ("bind" in el === false) delete attrs.bind
    if ("range" in el === false) delete attrs.range
    if ("prose" in el === false) delete attrs.prose
  }

  renderAttributes(el, attrs, stage)

  // MARK: Animation
  // ---------------

  if (animation === false) {
    el.classList.add("animation-false")
  }

  // MARK: Events
  // ------------

  // @ts-ignore
  const signal = el.signal ?? stage?.signal

  if (menu) renderButtonMenu(el, menu, stage)
  if (action) {
    const event =
      isControl && el.localName !== "button" //
        ? "input"
        : "click"
    el.addEventListener(
      event,
      (e) => {
        const res = action(e, el)
        if (res === false) stopEvent(e)
      },
      { signal },
    )
  }
  if (on) renderEventMap(el, on, signal)

  // MARK: content
  // -------------

  if (label && "label" in el) {
    el.label = label
    label = ""
  }

  if (content && "content" in el) {
    el.content = content
    content = undefined
  }

  if (text) el.textContent = text
  else if (content) render(content, el, stage)

  let controlType
  let boxRendered
  let out = el

  // MARK: Control
  // -------------

  if (isControl) {
    // @ts-ignore
    const { name, type } = el
    controlType = type

    if (
      !isComponent &&
      !(
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        parent?.localName === "label"
      )
    ) {
      if (label === undefined && name) {
        label = toTitleCase(name)
      }

      if (label) {
        if (localName === "fieldset") {
          const legendEl = document.createElement("legend")
          render(label, legendEl, stage)
          el.prepend(legendEl)
        } else if (localName === "button") {
          if (!content) render(label, el, stage)
        } else {
          const labelEl = document.createElement("label")
          el.id ||= uid()
          labelEl.htmlFor = el.id

          render(label, labelEl, cloneStage(stage, { isRoot: true }))

          if (!labelEl.textContent && name) {
            labelEl.textContent = toTitleCase(name)
          }

          if (box) {
            out = getBoxContainer(box, type, stage)
          } else {
            out = document.createElement("div")
            out.className = `control-box control-box--${type}`
          }

          boxRendered = true

          if (type === "radio" || type === "checkbox") {
            out.append(el)
            out.append(labelEl)
          } else {
            out.append(labelEl)
            out.append(el)
          }
        }
      }
    }
  } else if (
    label &&
    !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))
  ) {
    el.ariaLabel = toPlanString(label)
  }

  if (box && !boxRendered) {
    const tmp = getBoxContainer(box, controlType, stage)
    tmp.append(out)
    out = tmp
  }

  // MARK: Traits
  // ------------

  // lazy load traits
  const undones = []

  for (const key in traitOptions) {
    if (!Object.hasOwn(traitOptions, key)) continue

    if (traitOptions[key]) {
      const options = { signal, ...traitOptions[key] }
      if (key in el) el[key] = options
      else if (key === "renamable") {
        // @ts-ignore
        renamableTrait(el, options)
      } else {
        undones.push(
          import(`./trait/${key}.js`).then((module) =>
            module[key](el, options),
          ),
        )
      }
    }
  }

  if (stage && undones.length > 0) stage.undones = undones

  // MARK: css
  if (css) {
    out.id ||= uid()
    const style = document.createElement("style")
    style.textContent = `#${out.id} {\n${css}\n}`
    if (isComponent) {
      // @ts-ignore
      el.ready.then(() => out.append(style))
    } else out.append(style)
  }

  if (parent) parent.append(out)

  // MARK: list
  if (list) {
    if (Array.isArray(list)) {
      const id = uid()
      render({ tag: "datalist", id, content: list }, parent ?? out, stage)
      el.setAttribute("list", id)
    } else {
      el.setAttribute("list", list)
    }
  }

  created?.(el, { signal, plan, undones, stage, parent, out })

  if (stage?.isComponent) stage.isComponent = false

  return frag ?? out
}

export const comment = (text) => document.createComment(text)
export const br = { tag: "br" }
export const hr = { tag: "hr" }
export const nl = "\n"
export const tab = "\t"
export const zwsp = "\u200b"

render.comment = comment
render.br = br
render.hr = hr
render.nl = nl
render.tab = tab
render.zwsp = zwsp
