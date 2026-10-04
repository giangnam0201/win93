import { Canceller } from "../lib/class/Canceller.js"
import { Emitter } from "../lib/class/Emitter.js"
import { SecurityError } from "../lib/class/error/SecurityError.js"
import { getTypeOf } from "../lib/type/any/getTypeOf.js"
import { isInstanceOf } from "../lib/type/any/isInstanceOf.js"
import { Deferred } from "../lib/type/promise/defer.js"
import { realm } from "./env/realm.js"
import { uid } from "./uid.js"

const EMIT = "42_IPC_EMIT"
const ASK = "42_IPC_ASK"
const REPLY = "42_IPC_REPLY"
// const HANDSHAKE = "42_IPC_HANDSHAKE"

const _EVENTS = Symbol.for("Emitter.EVENTS")

const askQueue = {}

const { origin: targetOrigin } = new URL(import.meta.url)

const sources = new WeakMap()

const globalContext = { emit: undefined }

if (realm.inTop) {
  globalContext.emit = () => {
    console.log("emit from top")
  }
} else if (realm.inIframe) {
  globalContext.emit = (message, options, targetOrigin) => {
    window.parent.postMessage(message, {
      targetOrigin,
      ...options,
    })
  }
} else if (realm.inChildWindow) {
  globalContext.emit = (message, options, targetOrigin) => {
    window.opener.postMessage(message, {
      targetOrigin,
      ...options,
    })
  }
} else if (realm.inDedicatedWorker) {
  globalContext.emit = (message, options) => self.postMessage(message, options)
} else if (realm.inSharedWorker) {
  globalContext.emit = () => {
    console.log("emit from sharedWorker")
  }
} else if (realm.inServiceWorker) {
  globalContext.emit = async (message, options) => {
    for (const client of await self.clients.matchAll({
      includeUncontrolled: true,
    })) {
      client.postMessage(message, options)
    }
  }
}

// context.emit({
//   type: HANDSHAKE,
//   url: location.href,
//   realm: String(realm),
// })

function findIframe(source) {
  for (const el of document.querySelectorAll("iframe")) {
    if (el.contentWindow === source) return el
  }
}

async function handleMessage(data, source) {
  switch (data.type) {
    // case HANDSHAKE:
    //   console.log("HANDSHAKE", String(realm), data)
    //   break

    case EMIT: {
      const { events, args } = data
      ipc.local.emit(events, ...args)
      sources.get(source)?.local.emit(events, ...args)
      break
    }

    case ASK: {
      const { event, id, args } = data
      const bus = sources.get(source)
      const res = await (bus
        ? bus.local.ask(event, ...args)
        : ipc.local.ask(event, ...args))
      source.postMessage({ type: REPLY, id, res })
      break
    }

    case REPLY: {
      const { id, res } = data
      if (askQueue[id]) askQueue[id].resolve(res)
      break
    }

    default:
      break
  }
}

// MARK: Sender
// ------------

class Sender extends Emitter {
  targetOrigin = targetOrigin

  constructor(context, options) {
    super({ signal: options?.signal })
    this.context = context
    this.local = {
      emit: (events, ...args) => super.emit(events, ...args),
      ask: (events, ...args) => super.ask(events, ...args),
    }
  }

  /**
   * @param {string | string[]} events
   * @param {...any} args
   */
  emit(events, ...args) {
    this.context.emit(
      { type: EMIT, events, args },
      undefined,
      this.targetOrigin,
    )
    return this
  }

  /**
   * @param {string} event
   * @param {...any} args
   */
  async ask(event, ...args) {
    const id = uid()
    this.context.emit(
      { type: ASK, id, event, args },
      undefined,
      this.targetOrigin,
    )
    const deferred = new Deferred()
    askQueue[id] = deferred
    return deferred
  }
}

// MARK: Bus
// ---------

export class Bus extends Sender {
  static register(source, options, sourcePostMessage) {
    sourcePostMessage ??= source
    source.addEventListener(
      "message",
      ({ isTrusted, data }) => {
        if (!isTrusted || !data?.type) return
        handleMessage(data, sourcePostMessage)
      },
      options,
    )

    // https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/start
    if (isInstanceOf(source, MessagePort)) source.start()
  }

  /** @param {Window} contentWindow */
  #addWindowSource(contentWindow) {
    this.source = contentWindow

    if (!this.iframe && !contentWindow.opener) {
      this.iframe = findIframe(contentWindow)
    }

    let { targetOrigin } = this

    if (!targetOrigin) {
      if (this.iframe) {
        const iframeOrigin = this.iframe.src
          ? new URL(this.iframe.src).origin
          : location.origin

        targetOrigin =
          iframeOrigin === location.origin
            ? this.iframe.hasAttribute("sandbox")
              ? this.iframe.sandbox.contains("allow-same-origin")
                ? location.origin
                : "*" // only wildcard allowed: sandboxed iframe from same origin but marked as opaque origin ("null")
              : location.origin
            : false

        if (!targetOrigin) {
          throw new SecurityError(
            `Untrusted iframe origin: ${iframeOrigin}, you can allow it using the \`targetOrigin\` option`,
          )
        }
      }
    }

    sources.set(this.source, this)

    this.context.emit = (message, options) => {
      if (this.signal.aborted) throw this.signal.reason
      this.source.postMessage(message, {
        ...options,
        targetOrigin,
      })
    }
  }

  constructor(source, options) {
    const { cancel, signal } = new Canceller(options?.signal)

    const context = {
      emit: (message, options) => {
        if (signal.aborted) throw signal.reason
        this.source.postMessage(message, options)
      },
    }

    super(context, { signal })

    this.cancel = cancel
    this.signal = signal
    this.targetOrigin =
      typeof options === "string" //
        ? options
        : options?.targetOrigin

    if ("onmessage" in source) {
      if (globalThis.Window && isInstanceOf(source, Window)) {
        this.#addWindowSource(source)
      } else {
        this.source = source
        sources.set(this.source, this)
        Bus.register(this.source, { signal })
      }
    } else if ("port" in source) {
      this.source = source.port
      sources.set(this.source, this)
      Bus.register(this.source, { signal })
    } else if (
      globalThis.HTMLIFrameElement &&
      source instanceof HTMLIFrameElement
    ) {
      this.iframe = source
      if (source.contentWindow) {
        this.#addWindowSource(source.contentWindow)
      } else {
        const queue = []
        this.context.emit = (...args) => queue.push(args)
        source.addEventListener(
          "load",
          () => {
            this.#addWindowSource(source.contentWindow)
            for (const args of queue) this.context.emit(...args)
            queue.length = 0
          },
          { signal },
        )
      }
    } else if (isInstanceOf(source, ServiceWorker)) {
      this.source = source
      sources.set(this.source, this)
      Bus.register(navigator.serviceWorker, { signal }, source)
    } else {
      throw new TypeError(`\`source\` is not valid, got: ${getTypeOf(source)}`)
    }
  }

  async askOnce(event, data, options) {
    const res = await this.ask(event, data, options)
    this.destroy()
    return res
  }

  destroy() {
    this.cancel(`Bus destroyed`)

    if (_EVENTS in this) {
      this.off("*")
      delete this[_EVENTS]
    }

    sources.delete(this.source)
    if (isInstanceOf(this.source, MessagePort)) this.source.close()
    this.source = undefined
  }
}

// MARK: IPC
// ---------

class IPC extends Sender {
  constructor() {
    if (globalContext.ipc) return globalContext.ipc
    super(globalContext)
  }

  register(source, options) {
    const { cancel, signal } = new Canceller(options)
    Bus.register(source, { signal })
    return cancel
  }

  bus(source, options) {
    return new Bus(source, options)
  }
}

export const ipc = new IPC()
globalContext.ipc = ipc

globalThis.addEventListener("message", ({ isTrusted, data, source }) => {
  if (!isTrusted || !data?.type) return
  handleMessage(data, source)
})
