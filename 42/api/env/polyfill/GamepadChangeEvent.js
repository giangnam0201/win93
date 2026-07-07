// @implement https://github.com/w3c/gamepad/blob/26527bd0bc9ce6bab98e93a38988835adacad030/index.html
// explainer: https://docs.google.com/document/d/1At2ZsMOow4LmIhLs_LfnUV8J9glJS8qSyW-PqYtrQVA/edit

const GAMEPAD_PROPS = Object.keys(globalThis.Gamepad.prototype)

// @ts-ignore
class Gamepad extends EventTarget {
  __tracked
  constructor(tracked) {
    super()
    this.__tracked = tracked

    const descriptors = /** @type {any} */ ({})
    for (const item of GAMEPAD_PROPS) {
      descriptors[item] = { get: () => this.__tracked.originalGamepad[item] }
    }
    Object.defineProperties(this, descriptors)
  }
}

/**
 * @typedef {{
 *   gamepadIndex: number;
 *   buttonIndex: number;
 *   buttonSnapshot: GamepadButton;
 *   gamepadTimestamp: number;
 * }} GamepadButtonEventInit
 *
 * @typedef {{
 *   gamepadSnapshot: Gamepad,
 *   axesChanged: number[],
 *   buttonsChanged: number[],
 *   buttonsPressed: number[],
 *   buttonsReleased: number[],
 * }} GamepadChangeEventInit
 */

class GamepadButtonEvent extends Event {
  /**
   * @param {string} type
   * @param {GamepadButtonEventInit} params1
   */
  constructor(
    type,
    { gamepadIndex, buttonIndex, buttonSnapshot, gamepadTimestamp },
  ) {
    super(type)
    this.gamepadIndex = gamepadIndex
    this.buttonIndex = buttonIndex
    this.buttonSnapshot = buttonSnapshot
    this.gamepadTimestamp = gamepadTimestamp
  }
}

class GamepadChangeEvent extends Event {
  constructor(
    type,
    {
      gamepadSnapshot,
      axesChanged,
      buttonsChanged,
      buttonsPressed,
      buttonsReleased,
    },
  ) {
    super(type)
    this.gamepadSnapshot = gamepadSnapshot
    this.axesChanged = axesChanged
    this.buttonsChanged = buttonsChanged
    this.buttonsPressed = buttonsPressed
    this.buttonsReleased = buttonsReleased
  }
}

const tracker = new Map()

let isListening
let rafId

function addGamepad(gamepad) {
  const { index, buttons, axes } = gamepad
  const tracked = {
    originalGamepad: gamepad,
    timestamp: Infinity,
    buttons: buttons.map(() => ({ pressed: false, value: 0 })),
    axes: axes.map(() => 0),
  }
  // @ts-ignore
  tracked.gamepad = new Gamepad(tracked)
  tracker.set(index, tracked)
  return tracked
}

function update() {
  const gamepads = navigator.getGamepads()

  for (const gamepad of gamepads) {
    if (!gamepad) continue

    // @ts-ignore
    const tracked = gamepad.__tracked

    if (tracked.timestamp === gamepad.timestamp) continue // no change
    tracked.timestamp = gamepad.timestamp

    const axesChanged = []
    const buttonsChanged = []
    const buttonsPressed = []
    const buttonsReleased = []

    for (let i = 0, l = gamepad.buttons.length; i < l; i++) {
      const button = gamepad.buttons[i]
      const { pressed } = button
      if (tracked.buttons[i].pressed !== pressed) {
        tracked.buttons[i].pressed = pressed
        if (pressed) {
          buttonsChanged.push(i)
          buttonsPressed.push(i)
          tracked.gamepad.dispatchEvent(
            new GamepadButtonEvent("buttondown", {
              gamepadIndex: gamepad.index,
              buttonIndex: i,
              buttonSnapshot: button,
              gamepadTimestamp: gamepad.timestamp,
            }),
          )
        } else {
          buttonsChanged.push(i)
          buttonsReleased.push(i)
          tracked.gamepad.dispatchEvent(
            new GamepadButtonEvent("buttonup", {
              gamepadIndex: gamepad.index,
              buttonIndex: i,
              buttonSnapshot: button,
              gamepadTimestamp: gamepad.timestamp,
            }),
          )
        }
      }
    }

    for (let i = 0, l = gamepad.axes.length; i < l; i++) {
      const value = gamepad.axes[i]
      if (tracked.axes[i] !== value) {
        tracked.axes[i] = value
        axesChanged.push(i)
      }
    }

    if (axesChanged.length > 0 || buttonsChanged.length > 0) {
      tracked.gamepad.dispatchEvent(
        new GamepadChangeEvent("gamepadchange", {
          gamepadSnapshot: tracked.originalGamepad,
          axesChanged,
          buttonsChanged,
          buttonsPressed,
          buttonsReleased,
        }),
      )
    }
  }
}

function loop() {
  update()
  rafId = requestAnimationFrame(loop)
}

// @ts-ignore
if (!window.GamepadChangeEvent) {
  // @ts-ignore
  globalThis.sys42 ??= {}
  globalThis.sys42.polyfills ??= []
  globalThis.sys42.polyfills.push("GamepadChangeEvent")

  // @ts-ignore
  window.GamepadChangeEvent = GamepadChangeEvent
  // @ts-ignore
  window.GamepadButtonEvent = GamepadButtonEvent

  const getGamepad = Object.getOwnPropertyDescriptor(
    window.GamepadEvent.prototype,
    "gamepad",
  ).get

  Object.defineProperty(window.GamepadEvent.prototype, "gamepad", {
    get() {
      const gamepad = getGamepad.call(this)
      const tracked = tracker.get(gamepad.index) ?? addGamepad(gamepad)
      tracked.originalGamepad = gamepad
      return tracked.gamepad
    },
  })

  const originalGetGamepads = navigator.getGamepads.bind(navigator)

  const out = [null, null, null, null]
  navigator.getGamepads = function getGamepads() {
    const gamepads = originalGetGamepads()

    for (let i = 0, l = gamepads.length; i < l; i++) {
      if (gamepads[i]) {
        const gamepad = gamepads[i]
        const tracked = tracker.get(gamepad.index) ?? addGamepad(gamepad)
        tracked.originalGamepad = gamepad
        out[i] = tracked.gamepad
      } else {
        tracker.delete(i)
        out[i] = null
      }
    }

    return out
  }

  const polyfillStopPolling = () => {
    isListening = false
    cancelAnimationFrame(rafId)
  }

  const polyfillStartPolling = () => {
    if (isListening) return
    isListening = true
    loop()
  }

  // @ts-ignore
  navigator.getGamepads.__polyfillStopPolling = polyfillStopPolling

  // @ts-ignore
  navigator.getGamepads.__polyfillStartPolling = polyfillStartPolling

  globalThis.addEventListener(
    "gamepadconnected",
    ({ gamepad }) => {
      addGamepad(gamepad)
      if (!isListening) setTimeout(polyfillStartPolling, 0)
    },
    { once: true },
  )

  globalThis.addEventListener("gamepaddisconnected", () => {
    const gamepads = navigator.getGamepads()
    if (!gamepads.some(Boolean)) polyfillStopPolling()
  })
}
