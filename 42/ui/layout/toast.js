/* eslint-disable complexity */
import { getDesktopRealm } from "../../api/env/realm/getDesktopRealm.js"
import { untilIdle } from "../../lib/timing/untilIdle.js"
import { normalizePlanIcon } from "../../api/gui/normalizePlanIcon.js"
import { toPlanObject, render } from "../../api/gui/render.js"
import { isErrorLike } from "../../lib/type/any/isErrorLike.js"
import { animateTo, animateFrom } from "../../lib/type/element/animate.js"
import { normalizeError } from "../../lib/type/error/normalizeError.js"
import { defer } from "../../lib/type/promise/defer.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"

/**
 * @import {Plan} from "../../api/gui/render.js"
 * @typedef {HTMLElement & {
 *   closed: Promise<void>
 *   close: () => Promise<void>
 * }} BubbleElement
 */

/** @type {HTMLElement} */
let toastContainer

/**
 * @param {Plan} message
 * @param {string} tag
 * @param {any & {container?: HTMLElement}} [options]
 * @returns {Promise<BubbleElement>}
 */
export async function balloon(message, tag, options) {
  let isError = false
  if (isErrorLike(message)) {
    isError = true
    const error = normalizeError(message)
    message = error.message
    if (isInstanceOf(error.cause, Error)) {
      message = `%md ${message}\n  **Caused by:** ${error.cause.message}`
    }
    options ??= {}
    options.label ??= error.name
    options.picto ??= "error"

    console.group(tag)
    console.log(error)
    console.groupEnd()
  } else if (typeof message === "object") {
    options = { ...options, ...message }
    message = options.message
  }

  options ??= {}
  const container = options.container ?? document.documentElement

  const done = defer()
  const placeholder = document.createComment(`${tag} placeholder`)
  container.append(placeholder)

  let img
  if (options.icon || options.img || options.picto) {
    img = await normalizePlanIcon(options)
  }

  let speed
  let timeoutId
  function autoDismiss() {
    timeoutId = setTimeout(close, speed)
  }

  async function close() {
    el.dispatchEvent(new CustomEvent("ui:toast.close", { bubbles: true }))
    if (options.animateTo !== false) {
      await animateTo(
        el,
        options.animateTo ?? [
          {
            translate: "100%",
            boxShadow: "0 0 0 #0000",
            opacity: 0,
            minHeight: 0,
            height: 0,
            duration: 50,
          },
        ],
      )
    }
    el.remove()
    done.resolve()
  }

  let { content, ...rest } = toPlanObject(message)
  let firstChildClass = `.${tag}__message`
  let prelabel

  if (img) {
    if (options.picto) {
      prelabel = img
      if (options.icon) {
        img = await normalizePlanIcon({ icon: options.icon })
      }
    }

    if (options.icon) {
      content = {
        tag: ".cols.items-center.gap",
        content: [{ tag: ".aside", content: img }, { content }],
      }
    }
  }

  let body
  let footer
  if (options.label) {
    firstChildClass = `.${tag}__header`

    body = {
      tag: `.${tag}__body`,
      content,
    }

    content = [{ tag: `h2.${tag}__title`, content: options.label }]
  }

  if (options.footer) {
    footer = { tag: `footer.${tag}__footer`, content: options.footer }
  }

  content = [
    options.beforeContent,
    {
      tag: `${firstChildClass}.cols.items-center.shrink.gap`,
      content: [
        prelabel,
        { content },
        options.closable !== false && {
          tag: `button.${tag}__close`,
          picto: "close",
          aria: { label: "Close" },
          style: { alignSelf: "start" },
          on: {
            click() {
              close()
              return false
            },
          },
        },
      ],
    },
    body,
    options.afterContent,
    footer,
  ]

  const el = /** @type {BubbleElement} */ (
    render({
      tag,
      role: "alert",
      aria: { live: "polite" },
      on:
        options.closeOnContextmenu === false
          ? undefined
          : {
              prevent: true,
              contextmenu: close,
            },
      content,
      ...rest,
    })
  )

  el.close = close
  el.closed = done

  if (isError) el.classList.add("ui-toast--error")

  placeholder.replaceWith(el)

  el.dispatchEvent(new CustomEvent("ui:toast.open", { bubbles: true }))

  if (options.animateFrom !== false) {
    await animateFrom(
      el,
      options.animateFrom ?? { translate: "100%", opacity: 0 },
    )
  }

  if (options.timeout !== false) {
    el.onpointerenter = () => clearTimeout(timeoutId)
    el.onpointerleave = () => autoDismiss()

    if (typeof options.timeout === "number") speed = options.timeout
    else {
      let words = el.textContent.length
      words /= 5
      speed = (words / (180 / 60)) * 1000 + 3000
    }

    autoDismiss()
  }

  return el
}

/**
 * @param {Plan} message
 * @param {any} [options]
 */
export async function toast(message, options) {
  if (options?.contained !== true) {
    const desktopRealm = getDesktopRealm()
    if (desktopRealm !== window && desktopRealm.sys42?.toast) {
      return desktopRealm.sys42?.toast(message, options)
    }
  }

  // Let the UI settle before showing the toast
  if (options?.instant !== true) await untilIdle({ timeout: 500 })

  if (!toastContainer) {
    toastContainer = document.querySelector("ui-toaster")

    if (!toastContainer) {
      toastContainer = document.createElement("ui-toaster")
      document.documentElement.append(toastContainer)
    }

    toastContainer.role = "region"
    toastContainer.tabIndex = -1
    toastContainer.ariaLabel = "0 notification."
  }

  // const el = await balloon(message, "ui-toast", toastContainer, options)
  const el = await balloon(message, "ui-toast", {
    container: toastContainer,
    ...options,
  })

  toastContainer.ariaLabel = `${toastContainer.children.length} notification.`
  toastContainer.scrollTop = toastContainer.scrollHeight

  return el
}
