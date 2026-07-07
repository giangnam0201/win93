import { Emitter } from "../../../lib/class/Emitter.js"
import { clear } from "../../../lib/type/object/clear.js"
import "../polyfill/GamepadChangeEvent.js"

// @read https://w3c.github.io/gamepad/#dfn-standard-gamepad-layout
// @read https://cyangmou.itch.io/animated-button-props-for-consols
// @read https://sancarlosminas.info/46-xbox-one-controller-layout-cz8y/xbox-one-controller-layout-play-half-life-with-xbox-360-controller-on-mac-osx/

// @related https://github.com/MozillaReality/gamepad-plus/blob/master/src/lib/gamepads.js
// @related https://github.com/cdleveille/gamepad-helper/blob/main/gamepadhelper.js
// @related https://github.com/ethanaobrien/Gamepad

// @mapping https://github.com/neogeek/gamepad.js/blob/1x/mappings.json

/*
       ╭╴ 6 ╶╮                ╭╴ 7 ╶╮
  ╭────┤╴ 4 ╶├────────────────┤╴ 5 ╶├────╮
  │     ┌───┐                  ┌───┐     │
  │     │ 12│        16        │ 3 │     │
  │ ┌───┼───┼───┐          ┌───┼───┼───┐ │
  │ │ 14│   │ 15│          │ 2 │   │ 1 │ │
  │ └───┼───┼───┘  8    9  └───┼───┼───┘ │
  │     │ 13│                  │ 0 │     │
  │     └───┘ ╭ - ─╮    ╭─ - ╮ └───┘     │
  ╰────── [0] - 10 + ── - 11 + [2] ──────╯
              ╰ + ─╯    ╰─ + ╯
               [1]        [3]
*/

const status = {
  1: { device: { name: "Gamepad 1", index: 1 } },
  2: { device: { name: "Gamepad 2", index: 2 } },
  3: { device: { name: "Gamepad 3", index: 3 } },
  4: { device: { name: "Gamepad 4", index: 4 } },
}

const AXES = {
  0: "LEFT_STICK_X",
  1: "LEFT_STICK_Y",
  2: "RIGHT_STICK_X",
  3: "RIGHT_STICK_Y",
}

const BUTTONS = {
  0: "BUTTON_1",
  1: "BUTTON_2",
  2: "BUTTON_3",
  3: "BUTTON_4",
  4: "LT",
  5: "RT",
  6: "LB",
  7: "RB",
  8: "SELECT",
  9: "START",
  10: "LEFT_STICK",
  11: "RIGHT_STICK",
  12: "DPAD_UP",
  13: "DPAD_DOWN",
  14: "DPAD_LEFT",
  15: "DPAD_RIGHT",
  16: "HOME",
}

export function parseGamepadId(id) {
  let matches
  if (id.includes("Vendor: ")) {
    matches = id.match(
      /(?<name>.*?) *\(.*?Vendor: (?<vendor>[\da-z]{1,4}) Product: (?<product>[\da-z]{1,4})\)/,
    )
  } else {
    matches = id.match(
      /^(?<vendor>[\da-z]{1,4})-(?<product>[\da-z]{1,4})-(?<name>.*)/,
    )
  }

  if (matches) {
    return {
      name: matches.groups.name.replace(/^\b(\w+)(?:\W+\1\b)+/i, "$1"), // replace duplicate vendor
      vendor: matches.groups.vendor,
      product: matches.groups.product,
    }
  }

  return { name: id, vendor: "", product: "" }
}

globalThis.addEventListener("gamepaddisconnected", ({ gamepad }) => {
  const idx = gamepad.index + 1

  for (const key in status[idx]) {
    if (Object.hasOwn(status[idx], key) && key !== "device") {
      delete status[idx][key]
    }
  }

  clear(status[idx].device)
  status[idx].device.index = idx
  status[idx].device.name = `Gamepad ${idx}`

  gamepads.emit("disconnected", status[idx])
})

globalThis.addEventListener("gamepadconnected", ({ gamepad }) => {
  const idx = gamepad.index + 1
  const gamepadIndex = idx

  Object.assign(status[idx].device, {
    ...parseGamepadId(gamepad.id),
    mapping: gamepad.mapping,
  })

  for (let i = 0, l = gamepad.buttons.length; i < l; i++) {
    const label = `BUTTON_${i + 1}`
    status[idx][label] = gamepad.buttons[i].value
  }

  for (let i = 0, l = gamepad.axes.length; i < l; i++) {
    const label = `AXIS_${i + 1}`
    status[idx][label] = gamepad.axes[i]
  }

  gamepads.emit("connected", status[idx])

  gamepad.addEventListener("buttondown", (e) => {
    if (!gamepads.isListening) return
    const generic = `BUTTON_${e.buttonIndex + 1}`
    const label = BUTTONS[e.buttonIndex] ?? generic
    const { value } = e.buttonSnapshot
    status[idx][generic] = value
    const data = { gamepadIndex, label, generic, value }
    gamepads.emit("buttondown", data)
    gamepads.emit("change", data)
  })

  gamepad.addEventListener("buttonup", (e) => {
    if (!gamepads.isListening) return
    const generic = `BUTTON_${e.buttonIndex + 1}`
    const label = BUTTONS[e.buttonIndex] ?? generic
    const { value } = e.buttonSnapshot
    status[idx][generic] = value
    const data = { gamepadIndex, label, generic, value }
    gamepads.emit("buttonup", data)
    gamepads.emit("change", data)
  })

  gamepad.addEventListener("gamepadchange", (e) => {
    if (!gamepads.isListening) return
    if (e.axesChanged.length > 0) {
      for (const axisIdx of e.axesChanged) {
        const generic = `AXIS_${axisIdx + 1}`
        const axis = AXES[axisIdx] ?? generic

        let value = e.gamepadSnapshot.axes[axisIdx]
        if (value < 0.01 && value > -0.01) value = 0
        status[idx][generic] = value

        const suffix = value >= 0 ? ":+1" : ":-1"
        const label = axis + suffix
        const labelGeneric = generic + suffix

        const data = {
          gamepadIndex,
          label,
          value,
          axis,
          generic,
          labelGeneric,
        }

        gamepads.emit("axis", data)
        gamepads.emit("change", data)

        if (value === 0) {
          const oppositeData = {
            ...data,
            label: `${axis}:-1`,
            labelGeneric: `${generic}:-1`,
          }
          gamepads.emit("axis", oppositeData)
          gamepads.emit("change", oppositeData)
        }
      }
    }
  })
})

class Gamepads extends Emitter {
  isListening = false
  status = status
  listen() {
    this.isListening = true
  }
  forget() {
    this.isListening = false
  }

  // @ts-ignore
  get on() {
    this.isListening = true
    return super.on
  }
}

export const gamepads = new Gamepads()
