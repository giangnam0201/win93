/* eslint-disable max-depth */
import "../media/picto.js"
import { Component } from "../../api/gui/Component.js"
import { on } from "../../lib/event/on.js"
import { ensureElement } from "../../lib/type/element/ensureElement.js"
import { watchResize } from "../../lib/type/element/watchResize.js"
import { getRects } from "../../lib/dom/getRects.js"
import { inRect } from "../../lib/geometry/point.js"

const button = "button.ui-gamepad__button"
const buttonDpad = `${button}.ui-gamepad__dpad__button`

const DEFAULT_KEYMAP = {
  up: { code: "ArrowUp", extraZoneX: 0.8, extraZoneY: 0.15 },
  down: { code: "ArrowDown", extraZoneX: 0.8, extraZoneY: 0.15 },
  left: { code: "ArrowLeft", extraZoneX: 0.15, extraZoneY: 0.8 },
  right: { code: "ArrowRight", extraZoneX: 0.15, extraZoneY: 0.8 },
  a: { code: "KeyX" },
  b: { code: "KeyZ" },
  start: { code: "Enter" },
  select: { code: "ShiftRight" },
}

const DPAD = new Set(["up", "down", "left", "right"])

export class GamepadComponent extends Component {
  static plan = {
    tag: "ui-gamepad",
    props: {
      keymap: true,
      target: true,
    },
  }

  #keymap = DEFAULT_KEYMAP
  get keymap() {
    return this.#keymap
  }
  set keymap(value) {
    this.#keymap = value
  }

  /** @type {HTMLElement | SVGElement} */
  #target = document.body

  /** @returns {HTMLElement | SVGElement} */
  get target() {
    return this.#target
  }

  /** @param {string | HTMLElement} value */
  set target(value) {
    const el = ensureElement(value)
    this.#target = el
  }

  render() {
    return [
      {
        tag: ".ui-gamepad__main",
        content: [
          {
            tag: ".ui-gamepad__top",
            content: [
              {
                tag: ".ui-gamepad__dpad",
                content: {
                  tag: ".ui-gamepad__dpad__buttons",
                  content: [
                    { tag: `${buttonDpad}.ui-gamepad__left`, picto: "left" },
                    { tag: `${buttonDpad}.ui-gamepad__right`, picto: "right" },
                    { tag: `${buttonDpad}.ui-gamepad__up`, picto: "up" },
                    { tag: `${buttonDpad}.ui-gamepad__down`, picto: "down" },
                    { tag: ".button.ui-gamepad__center" },
                  ],
                },
              },
              {
                tag: ".ui-gamepad__buttons",
                content: [
                  { tag: `${button}.ui-gamepad__b.round`, content: "B" },
                  { tag: `${button}.ui-gamepad__a.round`, content: "A" },
                ],
              },
            ],
          },
          {
            tag: ".ui-gamepad__bottom",
            content: [
              {
                tag: `${button}.ui-gamepad__select.radius`,
                content: "Select",
              },
              {
                tag: `${button}.ui-gamepad__start.radius`,
                content: "Start",
              },
            ],
          },
        ],
      },
    ]
  }

  async initMapping() {
    const rects = await getRects(button)
    for (const key in this.#keymap) {
      if (Object.hasOwn(this.#keymap, key)) {
        const val = this.#keymap[key]
        val.key = key

        for (const rect of rects) {
          if (rect.target.matches(`.ui-gamepad__${key}`)) {
            const extraZoneX =
              rect.width * (val.extraZoneX ?? val.extraZone ?? 0.15)
            const extraZoneY =
              rect.height * (val.extraZoneY ?? val.extraZone ?? 0.15)
            rect.left -= extraZoneX
            rect.right += extraZoneX
            rect.top -= extraZoneY
            rect.bottom += extraZoneY

            val.rect = rect
            val.button = rect.target
            val.pressed = false

            const init = {
              key: val.key,
              code: val.code,
              bubbles: true,
              cancelable: true,
            }

            val.onPressDown ??= () =>
              this.target.dispatchEvent(new KeyboardEvent("keydown", init))

            val.onPressUp ??= () =>
              this.target.dispatchEvent(new KeyboardEvent("keyup", init))

            if (this.dpadEl && DPAD.has(val.key)) {
              const { onPressDown } = val
              val.onPressDown = () => {
                this.dpadEl.classList.toggle(
                  `ui-gamepad__dpad--${val.key}`,
                  true,
                )
                onPressDown()
              }

              const { onPressUp } = val
              val.onPressUp = () => {
                this.dpadEl.classList.toggle(
                  `ui-gamepad__dpad--${val.key}`,
                  false,
                )
                onPressUp()
              }
            }

            val.press = (value, pointerId) => {
              if (value === val.pressed) return
              val.pressed = value
              val.pointerId = pointerId
              val.button.classList.toggle("active", value)
              // navigator.vibrate(100)
              if (value) val.onPressDown()
              else val.onPressUp()
            }

            break
          }
        }
      }
    }
  }

  async created() {
    const { signal } = this

    this.dpadEl = this.querySelector(".ui-gamepad__dpad")

    watchResize(this, { signal, debounce: true }, () => this.initMapping())

    await this.initMapping()

    const mapping = Object.values(this.#keymap)

    on({ signal }, this, {
      "contextmenu": false,
      "pointermove || pointerdown": (e) => {
        if (!e.buttons) return
        for (const val of mapping) {
          if (inRect(e, val.rect)) val.press(true, e.pointerId)
          else if (val.pointerId === e.pointerId) val.press(false)
        }
      },
      "pointerup": (e) => {
        for (const val of mapping) {
          if (inRect(e, val.rect)) val.press(false)
        }
      },
    })
  }
}

export const gamepad = Component.define(GamepadComponent)
