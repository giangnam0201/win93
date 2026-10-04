const { AudioWorkletNode, AudioWorkletProcessor } = globalThis

export const inAudioWorklet = Boolean(AudioWorkletProcessor)

/**
 * @extends AudioWorkletNode
 */
export class AudioProcessorNode extends (AudioWorkletNode ?? Object) {
  static module = ""
  static loaded = undefined
  static loading = undefined

  static async load(ctx) {
    this.loaded ??= new WeakSet()
    this.loading ??= new WeakMap()

    if (this.loading.has(ctx)) await this.loading.get(ctx)
    else if (!this.loaded.has(ctx)) {
      const loading = ctx.audioWorklet.addModule(this.module)
      this.loading.set(ctx, loading)
      await loading
      this.loading.delete(ctx)
      this.loaded.add(ctx)
    }
  }

  static async init(ctx, parameterData) {
    await this.load(ctx)
    return new this(ctx, parameterData)
  }

  constructor(ctx, name, options) {
    let signal
    if (options?.parameterData?.signal) {
      signal = options.parameterData.signal
      delete options.parameterData.signal
    }

    options ??= {}
    options.outputChannelCount ??= [2]

    super(ctx, name, options)

    if (signal) {
      if (signal.aborted) this.destroy()
      else {
        this.signal = signal
        signal.addEventListener("abort", () => this.destroy())
      }
    }
  }

  setParameters(parameters = this.parameters.entries(), ignoreList) {
    for (const [key, audioParam] of parameters) {
      if (ignoreList?.includes(key)) continue
      if (key in this === false) {
        Object.defineProperty(this, key, {
          enumerable: true,
          get: () => audioParam,
        })
      } else if (this[key] === undefined) {
        this[key] = audioParam
      }
    }
  }

  destroy() {
    try {
      this.disconnect()
    } catch (err) {
      console.error(err)
    }

    this.port.postMessage({ stop: true })
  }
}

/**
 * @extends AudioWorkletProcessor
 */
export class AudioProcessor extends (AudioWorkletProcessor ?? Object) {
  static define(name, Class) {
    globalThis.registerProcessor?.(name, Class)
  }

  running = true

  constructor(options) {
    // @ts-ignore
    super(options)

    this.port.addEventListener("message", ({ data }) => {
      if (data.stop) this.running = false
    })

    this.port.start()
  }
}
