// @read https://github.com/whatwg/dom/issues/946#issuecomment-773954201

import { AbortError } from "./error/AbortError.js"

export class Canceller {
  /** @type {Canceller | undefined} */
  parent

  /** @param {AbortSignal} [signal] */
  constructor(signal) {
    const controller = new AbortController()

    this.signal = controller.signal

    this.cancel = (reason) => {
      if (typeof reason === "string") reason = new AbortError(reason)
      controller.abort(reason)
    }

    if (signal) this.addSignal(signal)
  }

  addSignal(signal) {
    signal.addEventListener("abort", () => this.cancel(signal.reason), {
      signal: this.signal,
    })
  }

  fork() {
    if (this.signal.aborted) {
      throw new Error("Impossible to fork a Canceller with aborted signal")
    }

    const fork = new Canceller(this.signal)
    fork.parent = this
    return fork
  }
}
