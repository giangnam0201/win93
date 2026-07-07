const windowExist = globalThis.window !== undefined
const selfExist = globalThis.self !== undefined

let stringCache

class Realm {
  constructor() {
    this.inWindow = windowExist && window === window.self
    this.inChildWindow = windowExist && globalThis.opener !== null

    this.inTop = windowExist && window === window.top
    this.inIframe = windowExist && window !== window.top
    this.inOpaqueOrigin = globalThis.origin === "null"
    this.inSandbox = this.inIframe && this.inOpaqueOrigin

    this.inWorker =
      selfExist &&
      globalThis.WorkerGlobalScope !== undefined &&
      self instanceof WorkerGlobalScope
    this.inSharedWorker =
      selfExist &&
      globalThis.SharedWorkerGlobalScope !== undefined &&
      self instanceof SharedWorkerGlobalScope
    this.inServiceWorker =
      selfExist &&
      globalThis.ServiceWorkerGlobalScope !== undefined &&
      self instanceof ServiceWorkerGlobalScope
    this.inDedicatedWorker =
      selfExist &&
      globalThis.DedicatedWorkerGlobalScope !== undefined &&
      self instanceof DedicatedWorkerGlobalScope

    this.inWorklet =
      globalThis.WorkletGlobalScope !== undefined &&
      globalThis instanceof globalThis.WorkletGlobalScope
    this.inAudioWorklet =
      globalThis.AudioWorkletGlobalScope !== undefined &&
      globalThis instanceof globalThis.AudioWorkletGlobalScope
    this.inPaintWorklet =
      globalThis.PaintWorkletGlobalScope !== undefined &&
      globalThis instanceof globalThis.PaintWorkletGlobalScope
  }

  toString() {
    if (stringCache) return stringCache

    if (this.inWindow) {
      if (this.inTop) stringCache = "top"
      else if (this.inSandbox) stringCache = "sandbox"
      else if (this.inIframe) stringCache = "iframe"
      else if (this.inChildWindow) stringCache = "childWindow"
    } else if (this.inWorker) {
      if (this.inDedicatedWorker) stringCache = "worker"
      else if (this.inSharedWorker) stringCache = "sharedWorker"
      else if (this.inServiceWorker) stringCache = "serviceWorker"
    } else if (this.inAudioWorklet) stringCache = "audioWorklet"
    else if (this.inPaintWorklet) stringCache = "paintWorklet"

    return stringCache
  }

  [Symbol.toPrimitive]() {
    return this.toString()
  }
}

export const realm = new Realm()
