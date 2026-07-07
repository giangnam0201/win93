import { inApple } from "../../../42/api/env/browser/inApple.js"
import { gamepads } from "../../../42/api/env/device/gamepads.js"
import { getDesktopRealm } from "../../../42/api/env/realm/getDesktopRealm.js"
import { injectComponents } from "../../../42/api/gui/injectComponents.js"
import { debounce } from "../../../42/lib/timing/debounce.js"
import { removeItem } from "../../../42/lib/type/array/removeItem.js"
import { form, demand } from "../../../42/ui/layout/dialog.js"

/** @import {PlanArray} from "../../../42/api/gui/render.js" */

export const SPECIAL_KEYS = new Set([24, 25, 26, 27, 28, 29, 30])
export const STICK_AXES = new Set([16, 17, 18, 19, 20, 21, 22, 23])
// prettier-ignore
export const OPPOSITE_AXES = { 16: 17, 17: 16, 18: 19, 19: 18, 20: 21, 21: 20, 22: 23, 23: 22 }

const DEFAULT_CONTROLLER = {
  gamepadIndex: 1,
  0: ["KeyX", "BUTTON_1"], // B
  1: ["KeyS", "BUTTON_3"], // Y
  2: ["ShiftRight", "SELECT"],
  3: ["Enter", "START"],
  4: ["ArrowUp", "DPAD_UP"],
  5: ["ArrowDown", "DPAD_DOWN"],
  6: ["ArrowLeft", "DPAD_LEFT"],
  7: ["ArrowRight", "DPAD_RIGHT"],
  // 4: ["ArrowUp", "AXIS_6:-1"],
  // 5: ["ArrowDown", "AXIS_6:+1"],
  // 6: ["ArrowLeft", "AXIS_5:-1"],
  // 7: ["ArrowRight", "AXIS_5:+1"],
  8: ["KeyZ", "BUTTON_2"], // A
  9: ["KeyA", "BUTTON_4"], // X
  10: ["KeyQ", "LT"],
  11: ["KeyE", "RT"],
  12: ["Tab", "LB"],
  13: ["KeyR", "RB"],
  14: ["Home", "LEFT_STICK"], // L3
  15: ["End", "RIGHT_STICK"], // R3
  16: ["KeyH", "LEFT_STICK_X:+1"], // L STICK RIGHT
  17: ["KeyF", "LEFT_STICK_X:-1"], // L STICK LEFT
  18: ["KeyG", "LEFT_STICK_Y:+1"], // L STICK DOWN
  19: ["KeyT", "LEFT_STICK_Y:-1"], // L STICK UP
  20: ["KeyL", "RIGHT_STICK_X:+1"], // R STICK RIGHT
  21: ["KeyJ", "RIGHT_STICK_X:-1"], // R STICK LEFT
  22: ["KeyK", "RIGHT_STICK_Y:+1"], // R STICK DOWN
  23: ["KeyI", "RIGHT_STICK_Y:-1"], // R STICK UP
  24: ["F5", ""], // Quick Save
  25: ["F9", ""], // Quick Load
  26: ["F6", ""], // Change Save Slot
  27: ["ShiftLeft", "HOME"], // Fast Forward
  28: [inApple ? "MetaRight" : "ControlRight", ""], // Rewind
  29: [inApple ? "MetaLeft" : "ControlLeft", ""], // Slow Motion
  30: [["Space", "KeyP"], ""], // Pause
}

export const DEFAULT_CONTROLLERS = {
  1: DEFAULT_CONTROLLER,
  2: /** @type {typeof DEFAULT_CONTROLLER} */ ({ gamepadIndex: 2 }),
  3: /** @type {typeof DEFAULT_CONTROLLER} */ ({ gamepadIndex: 3 }),
  4: /** @type {typeof DEFAULT_CONTROLLER} */ ({ gamepadIndex: 4 }),
}

// Copy gamepad controls to other players
for (const [key, val] of Object.entries(DEFAULT_CONTROLLERS[1])) {
  if (key === "gamepadIndex") continue
  if (val[1]) {
    DEFAULT_CONTROLLERS[2][key] = ["", val[1]]
    DEFAULT_CONTROLLERS[3][key] = ["", val[1]]
    DEFAULT_CONTROLLERS[4][key] = ["", val[1]]
  }
}

const GAMEPAD_PICTOS = {
  BUTTON_1: "gamepad-button-1",
  BUTTON_2: "gamepad-button-2",
  BUTTON_3: "gamepad-button-3",
  BUTTON_4: "gamepad-button-4",
  SELECT: "gamepad-select",
  START: "gamepad-start",
  HOME: "gamepad-home",
  LT: "gamepad-lt",
  RT: "gamepad-rt",
  LB: "gamepad-lb",
  RB: "gamepad-rb",
  LEFT_STICK: "gamepad-left-stick",
  RIGHT_STICK: "gamepad-right-stick",
  DPAD_UP: "gamepad-dpad-up",
  DPAD_RIGHT: "gamepad-dpad-right",
  DPAD_DOWN: "gamepad-dpad-down",
  DPAD_LEFT: "gamepad-dpad-left",
}

const INPUT_INDEX_PICTOS = {
  8: "gamepad-button-2", // A
  0: "gamepad-button-1", // B
  9: "gamepad-button-4", // X
  1: "gamepad-button-3", // Y
  // 2: "gamepad-select", // SELECT
  // 3: "gamepad-start", // START
  4: "gamepad-dpad-up", // UP
  7: "gamepad-dpad-right", // RIGHT
  5: "gamepad-dpad-down", // DOWN
  6: "gamepad-dpad-left", // LEFT
}

// https://retropie.org.uk/docs/RetroArch-Configuration/#example-default-per-system-retroarchcfg

export const CONTROLLER_LAYOUTS = {
  "COMMON": [
    [24, "Quick Save"],
    [25, "Quick Load"],
    [26, "Change Save Slot"],
    [27, "Fast Forward"],
    [29, "Slow Motion"],
    [28, "Rewind"],
    [30, "Pause"],
  ],
  "GENERIC": [
    [8, "A"],
    [0, "B"],
    [9, "X"],
    [1, "Y"],
    // NEOGEO
    // [8, "A"], BUTTON_1
    // [0, "B"], BUTTON_3
    // [9, "X"], BUTTON_2
    // [1, "Y"], BUTTON_4
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
    [10, "L"],
    [11, "R"],
    [12, "L2"],
    [13, "R2"],
    [14, "L3"],
    [15, "R3"],
    [19, "L STICK UP"],
    [18, "L STICK DOWN"],
    [17, "L STICK LEFT"],
    [16, "L STICK RIGHT"],
    [23, "R STICK UP"],
    [22, "R STICK DOWN"],
    [21, "R STICK LEFT"],
    [20, "R STICK RIGHT"],
  ],
  // "Nintendo Game Boy"
  "gb": [
    [8, "A"],
    [0, "B"],
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
  ],
  "Nintendo NES": [
    [8, "A"],
    [0, "B"],
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
    [10, "EJECT"], // Famicon games only
    [11, "SWAP DISKS"],
  ],
  "Nintendo Super NES": [
    [8, "A"],
    [0, "B"],
    [9, "X"],
    [1, "Y"],
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
    [10, "L"],
    [11, "R"],
  ],
  "Nintendo 64": [
    [0, "A"],
    [1, "B"],
    [3, "START"],
    [4, "D-PAD UP"],
    [5, "D-PAD DOWN"],
    [6, "D-PAD LEFT"],
    [7, "D-PAD RIGHT"],
    [10, "L"],
    [11, "R"],
    [12, "Z"],
    [19, "STICK UP"],
    [18, "STICK DOWN"],
    [17, "STICK LEFT"],
    [16, "STICK RIGHT"],
    [23, "C-PAD UP"],
    [22, "C-PAD DOWN"],
    [21, "C-PAD LEFT"],
    [20, "C-PAD RIGHT"],
  ],
  "Nintendo Game Boy Advance": [
    [8, "A"],
    [0, "B"],
    [10, "L"],
    [11, "R"],
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
  ],
  "Nintendo DS": [
    [8, "A"],
    [0, "B"],
    [9, "X"],
    [1, "Y"],
    [2, "SELECT"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
    [10, "L"],
    [11, "R"],
    [14, "Microphone"],
  ],
  "vb": [
    [8, "A"],
    [0, "B"],
    [10, "L"],
    [11, "R"],
    [2, "SELECT"],
    [3, "START"],
    [4, "LEFT D-PAD UP"],
    [5, "LEFT D-PAD DOWN"],
    [6, "LEFT D-PAD LEFT"],
    [7, "LEFT D-PAD RIGHT"],
    [19, "RIGHT D-PAD UP"],
    [18, "RIGHT D-PAD DOWN"],
    [17, "RIGHT D-PAD LEFT"],
    [16, "RIGHT D-PAD RIGHT"],
  ],
  "Sega Mega Drive": [
    [1, "A"],
    [0, "B"],
    [8, "C"],
    [10, "X"],
    [9, "Y"],
    [11, "Z"],
    [3, "START"],
    [2, "MODE"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
  ],
  "Sega Master System": [
    [0, "BUTTON 1"],
    [8, "BUTTON 2"],
    [3, "START"],
    [4, "UP"],
    [7, "RIGHT"],
    [5, "DOWN"],
    [6, "LEFT"],
  ],
  "Sega Game Gear": [
    [0, "BUTTON 1"],
    [8, "BUTTON 2"],
    [3, "START"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "Sega Saturn": [
    [1, "A"],
    [0, "B"],
    [8, "C"],
    [9, "X"],
    [10, "Y"],
    [11, "Z"],
    [12, "L"],
    [13, "R"],
    [3, "START"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "3do": [
    [1, "A"],
    [0, "B"],
    [8, "C"],
    [10, "L"],
    [11, "R"],
    [2, "X"],
    [3, "P"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "Atari 2600": [
    [0, "FIRE"],
    [2, "SELECT"],
    [3, "RESET"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
    [10, "LEFT DIFFICULTY A"],
    [12, "LEFT DIFFICULTY B"],
    [11, "RIGHT DIFFICULTY A"],
    [13, "RIGHT DIFFICULTY B"],
    [14, "COLOR"],
    [15, "B/W"],
  ],
  "Atari 7800": [
    [0, "BUTTON 1"],
    [8, "BUTTON 2"],
    [2, "SELECT"],
    [3, "PAUSE"],
    [9, "RESET"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
    [10, "LEFT DIFFICULTY"],
    [11, "RIGHT DIFFICULTY"],
  ],
  "Atari Lynx": [
    [8, "A"],
    [0, "B"],
    [10, "OPTION 1"],
    [11, "OPTION 2"],
    [3, "START"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "Atari Jaguar": [
    [8, "A"],
    [0, "B"],
    [1, "C"],
    [2, "PAUSE"],
    [3, "OPTION"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "pce": [
    [8, "I"],
    [0, "II"],
    [2, "SELECT"],
    [3, "RUN"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "ngp": [
    [0, "A"],
    [8, "B"],
    [3, "OPTION"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "ws": [
    [8, "A"],
    [0, "B"],
    [3, "START"],
    [4, "X UP"],
    [5, "X DOWN"],
    [6, "X LEFT"],
    [7, "X RIGHT"],
    [13, "Y UP"],
    [12, "Y DOWN"],
    [10, "Y LEFT"],
    [11, "Y RIGHT"],
  ],
  "coleco": [
    [8, "LEFT BUTTON"],
    [0, "RIGHT BUTTON"],
    [9, "1"],
    [1, "2"],
    [11, "3"],
    [10, "4"],
    [13, "5"],
    [12, "6"],
    [15, "7"],
    [14, "8"],
    [2, "*"],
    [3, "#"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
  "pcfx": [
    [8, "I"],
    [0, "II"],
    [9, "III"],
    [1, "IV"],
    [10, "V"],
    [11, "VI"],
    [3, "RUN"],
    [2, "SELECT"],
    [12, "MODE1"],
    [13, "MODE2"],
    [4, "UP"],
    [5, "DOWN"],
    [6, "LEFT"],
    [7, "RIGHT"],
  ],
}

CONTROLLER_LAYOUTS["Sega CD"] = CONTROLLER_LAYOUTS["Sega Mega Drive"]
CONTROLLER_LAYOUTS["Sega 32x"] = CONTROLLER_LAYOUTS["Sega Mega Drive"]
CONTROLLER_LAYOUTS.Arcade = [...CONTROLLER_LAYOUTS.GENERIC]
CONTROLLER_LAYOUTS.Arcade[4][1] = "INSERT COIN"

export function normalizeControls(controls) {
  const keyboard = {}
  const gamepad = {}
  const out = { keyboard, gamepad }

  for (let player = 0; player < 4; player++) {
    for (let index = 0; index < 31; index++) {
      const playerIdx = player + 1
      if (!controls[playerIdx][index]) continue
      const gamepadIndex = controls[playerIdx].gamepadIndex ?? 1
      const [kb, gp] = controls[playerIdx][index]

      for (const key of [gp].flat()) {
        if (!key) continue
        gamepad[`${gamepadIndex}_${key}`] = {
          player,
          index,
          opposite: OPPOSITE_AXES[index],
          isStick: STICK_AXES.has(index),
        }
      }

      for (const key of [kb].flat()) {
        if (!key) continue
        keyboard[key] = {
          player,
          index,
          value: STICK_AXES.has(index) ? 0x7f_ff : 1,
        }
      }
    }
  }

  return out
}

function changeGamepadIndex(tabsEl, player, index) {
  index = String(index)
  const gamepadSelect = tabsEl.querySelector(
    `#player${player} select.gamepad_index`,
  )

  // Swap gamepads
  for (const select of tabsEl.querySelectorAll("select.gamepad_index")) {
    if (select.value === index) select.value = gamepadSelect.value
  }

  gamepadSelect.value = index
}

async function listenForUserControl(tabsEl, player, index, val, signal) {
  let res
  let isKeyboard

  const { activeElement, defaultView } = tabsEl.ownerDocument // TODO: correctly set opener

  await demand({
    label: "Press keyboard or gamepad button/axis",
    content: {
      tag: ".cols.gap-xxs",
      content: [
        val + " ",
        { tag: "ui-picto", value: INPUT_INDEX_PICTOS[index] },
      ],
    },
    modal: true,
    agree: false,
    signal,
    dialog: {
      dataset: { animationIn: false, animationOut: false },
      created: (el) => {
        // console.log(el.signal === signal)
        // TODO: add components signal chain

        defaultView.addEventListener(
          "keydown",
          (e) => {
            e.preventDefault()
            e.stopImmediatePropagation()
            e.stopPropagation()
            isKeyboard = true
            res = e.code
            el.close()
          },
          { signal: el.signal },
        )

        gamepads.on(
          "buttondown || axis",
          { signal: el.signal },
          ({ label, value, gamepadIndex }) => {
            if (value < 0.5 && value > -0.5) return
            changeGamepadIndex(tabsEl, player, gamepadIndex)
            res = label
            el.close()
          },
        )
      },
    },
  })

  activeElement?.focus()

  console.log(res)

  if (!res) return

  if (isKeyboard) {
    for (const item of tabsEl.querySelectorAll("input.keyboard_input")) {
      const v = item.value.split(",")
      if (v.includes(res)) {
        removeItem(v, res)
        item.value = v.join(",")
      }

      if (item.name === `${player}.${index}.0`) {
        item.value = res
      }
    }
  } else {
    for (const item of tabsEl.querySelectorAll(
      `#player${player} input.gamepad_input`,
    )) {
      const v = item.value.split(",")
      if (v.includes(res)) {
        removeItem(v, res)
        item.value = v.join(",")
        if (item.previousElementSibling?.localName === "ui-picto") {
          item.previousElementSibling.value =
            GAMEPAD_PICTOS[item.value] ?? "transparent"
        }
      }

      if (item.name === `${player}.${index}.1`) {
        if (item.previousElementSibling?.localName === "ui-picto") {
          item.previousElementSibling.value =
            GAMEPAD_PICTOS[res] ?? "transparent"
        }

        item.value = res
      }
    }
  }
}

/**
 * @param {string} name
 * @param {any} [controls]
 */
export async function setControls(name, controls = DEFAULT_CONTROLLERS) {
  await injectComponents(
    new URL("../../../42/ui/layout/tabs.js", import.meta.url),
    getDesktopRealm(),
  )

  let tabsEl
  let signal
  const { status } = gamepads

  const layout = [
    ...(name in CONTROLLER_LAYOUTS
      ? CONTROLLER_LAYOUTS[name]
      : CONTROLLER_LAYOUTS.GENERIC),
    ...CONTROLLER_LAYOUTS.COMMON,
  ]

  /** @type {PlanArray} */
  const plan = []

  for (let player = 1; player <= 4; player++) {
    const { gamepadIndex } = controls[player]

    let previous

    /** @type {PlanArray} */
    const list = [
      {
        tag: ".cols.gap-xxs",
        content: [
          {
            tag: ".txt-right.shrink",
            style: { flexBasis: "15ch" },
            content: { tag: ".label", content: "Gamepad" },
          },
          {
            tag: ".colspan-2.pa-b",
            content: {
              tag: "select.gamepad_index",
              aria: { label: `Gamepad` },
              name: `${player}.gamepadIndex`,
              on: {
                focus: (e, target) => {
                  previous = target.value
                },
                change: (e, target) => {
                  // Swap gamepads
                  for (const select of tabsEl.querySelectorAll(
                    "select.gamepad_index",
                  )) {
                    if (select === target) continue
                    if (select.value === target.value) {
                      select.value = previous ?? 0
                    }
                  }
                },
              },
              content: [
                ["Gamepad N/A", 0],
                [status[1].device.name, 1, undefined, gamepadIndex === 1],
                [status[2].device.name, 2, undefined, gamepadIndex === 2],
                [status[3].device.name, 3, undefined, gamepadIndex === 3],
                [status[4].device.name, 4, undefined, gamepadIndex === 4],
              ],
            },
          },
        ],
      },
    ]

    const p = {
      label: `Player ${player}`,
      content: {
        tag: ".flex-rows.autoscroll.gap-xxs.ma-xs.h-full.scroll-y-auto",
        id: `player${player}`,
        content: list,
      },
    }

    for (const [index, val] of layout) {
      let picto = INPUT_INDEX_PICTOS[index]
      if (picto) picto = { after: picto }

      const keyboardInput = controls[player][index]?.[0]
      const gamepadInput = controls[player][index]?.[1]

      const gamepadPicto = GAMEPAD_PICTOS[gamepadInput] ?? "transparent"

      list.push({
        tag: ".cols.gap-xxs",
        tabIndex: 0,
        on: {
          "disrupt": true,
          "Enter || click": async () => {
            listenForUserControl(tabsEl, player, index, val, signal)
          },
        },
        content: [
          {
            tag: ".txt-right.shrink",
            style: { flexBasis: "15ch" },
            content: {
              tag: ".label",
              content: val + " ",
              picto,
            },
          },
          {
            tag: ".cols.gap-xxs",
            style: { width: "round(down, 51ch, 7px)" },
            content: [
              {
                tag: "input.keyboard_input",
                enterKeyHint: "go",
                tabIndex: -1,
                readonly: true,
                dataset: { player, index },
                aria: { label: `Keyboard input for ${val}` },
                name: `${player}.${index}.0`,
                value: keyboardInput,
              },
              {
                tag: ".field",
                picto: gamepadPicto,
                content: {
                  tag: "input.gamepad_input",
                  enterKeyHint: "go",
                  tabIndex: -1,
                  readonly: true,
                  aria: { label: `Gamepad input for ${val}` },
                  name: `${player}.${index}.1`,
                  value: gamepadInput,
                },
              },
              {
                tag: "button",
                picto: "pencil",
                tabIndex: -1,
              },
            ],
          },
        ],
      })
    }

    plan.push(p)
  }

  const res = await form(
    {
      tag: "ui-tabs.h-full",
      content: plan,
      created: (el) => {
        tabsEl = el
        signal = el.signal
        gamepads.on(
          "connected || disconnected",
          { signal },
          debounce(() => {
            if (el.signal.aborted) return
            for (const option of el.querySelectorAll(
              "select.gamepad_index option",
            )) {
              if (option.value in gamepads.status) {
                option.textContent = gamepads.status[option.value].device.name
              }
            }
          }),
        )
      },
    },
    {
      label: `Controls - ${name}`,
      picto: "devices/joystick",
      height: 435,
      // dialog: { resizable: true, height: 435, _width: 400 },
      // dialog: { style: { maxHeight: 435 } },
    },
  )

  if (!res) return

  const out = /** @type {typeof DEFAULT_CONTROLLERS} */ ({})

  for (const [key, val] of Object.entries(res)) {
    out[key] = {}
    for (const [key2, val2] of Object.entries(val)) {
      if (key2 === "gamepadIndex") {
        out[key][key2] = Number(val2)
      } else {
        let k = val2[0]?.split(",")
        let g = val2[1]?.split(",")
        if (k?.length === 1) k = k[0]
        if (g?.length === 1) g = g[0]
        out[key][key2] = [k, g]
      }
    }
  }

  return out
}
