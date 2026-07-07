//! Copyright (C) 2014-2017 Eitan Isaacson. GNU General Public License.

const PUSHER_BUFFER_SIZE = 4096

export class Speak {
  pushers = []

  constructor(audioContext) {
    this.ready = false
    this.context = audioContext ?? new AudioContext()
  }

  handleEvent(evt) {
    const { callback } = evt.data
    if (callback && this[callback]) {
      this[callback].apply(this, evt.data.result)
      if (evt.data.done) {
        delete this[callback]
      }
      return
    }
  }

  async init() {
    if (this.worker) return
    this.worker = new Worker(import.meta.resolve("./espeakng.worker.js"))
    return new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        if (e.data !== "ready") return
        this.worker.onmessage = null
        this.worker.addEventListener("message", this)
        this.ready = true
        resolve()
      }
    })
  }

  async getVoices() {
    if (!this.ready) await this.init()
    this.voices = []

    return new Promise((resolve) => {
      this.list_voices((result) => {
        for (const voice of result) {
          // const languages = voice.languages.map((lang) => lang.name).join(", ")
          // console.log(languages)
          this.voices.push([voice.name, voice.identifier])
        }

        this.voices.splice(35, 1) // gn_dict bug fix
        this.voices.splice(45, 1) // ipa_dist bug fix

        resolve(this.voices)
      })
    })
  }

  stopPusher(id) {
    for (let i = 0; i < this.pushers.length; i++) {
      if (this.pushers[i].id === id) {
        this.pushers[i].disconnect()
        this.pushers.splice(i, 1)
        break
      }
    }
  }

  stopAllPushers() {
    for (let i = this.pushers.length - 1; i >= 0; i--) {
      this.pushers[i].disconnect()
      this.pushers.splice(i, 1)
    }
  }

  async speak(text, options = {}) {
    if (!this.ready) await this.init()
    this.stopPusher(options.home)
    this.set_rate(options.speed ?? 100)
    this.set_pitch(options.pitch ?? 50)
    this.set_voice(options.voice ?? "en")
    let now = Date.now()
    // chunkID = 0;

    const pusher = new PushAudioNode(
      this.context,
      () => {},
      () => {
        const index = this.pushers.indexOf(pusher)
        if (index !== -1) {
          this.pushers.splice(index, 1)
        }
      },
      PUSHER_BUFFER_SIZE,
    )
    pusher.id = options.home
    pusher.connect(this.context.destination)

    this.pushers.push(pusher)

    this.synthesize(text, (samples) => {
      if (!samples) {
        if (pusher) pusher.close()
        return
      }
      if (pusher) {
        pusher.push(new Float32Array(samples))
        // ++chunkID;
      }
      if (now) now = 0
    })
  }
}

function _createAsyncMethod(method) {
  return function () {
    const lastArg = arguments[arguments.length - 1]
    const message = { method, args: Array.prototype.slice.call(arguments, 0) }
    if (typeof lastArg === "function") {
      const callback =
        "_" + method + "_" + Math.random().toString().slice(2) + "_cb"
      this[callback] = lastArg
      message.args.pop()
      message.callback = callback
    }
    this.worker.postMessage(message)
  }
}

for (const method of [
  "list_voices",
  "get_rate",
  "get_pitch",
  "set_rate",
  "set_pitch",
  "set_voice",
  "synthesize",
]) {
  Speak.prototype[method] = _createAsyncMethod(method)
}

class PushAudioNode {
  id

  constructor(context, start_callback, end_callback, buffer_size) {
    this.context = context
    this.start_callback = start_callback
    this.end_callback = end_callback
    this.buffer_size = buffer_size || 4096
    this.samples_queue = []
    this.scriptNode = context.createScriptProcessor(this.buffer_size, 1, 1)
    this.connected = false
    this.sinks = []
    this.startTime = 0
    this.closed = false
    this.track_callbacks = new Map()
  }
  push(chunk) {
    if (this.closed) {
      throw new Error("Cannot push more chunks after node was closed")
    }
    this.samples_queue.push(chunk)
    if (!this.connected) {
      if (this.sinks.length === 0) {
        throw new Error("No destination set for PushAudioNode")
      }
      this._do_connect()
    }
  }
  close() {
    this.closed = true
  }
  connect(dest) {
    this.sinks.push(dest)
    if (this.samples_queue.length > 0) {
      this._do_connect()
    }
  }
  _do_connect() {
    if (this.connected) return
    this.connected = true
    for (const dest of this.sinks) {
      this.scriptNode.connect(dest)
    }
    this.scriptNode.onaudioprocess = this.handleEvent.bind(this)
  }
  disconnect() {
    this.scriptNode.onaudioprocess = null
    this.scriptNode.disconnect()
    this.connected = false
  }
  addTrackCallback(aTimestamp, aCallback) {
    const callbacks = this.track_callbacks.get(aTimestamp) || []
    callbacks.push(aCallback)
    this.track_callbacks.set(aTimestamp, callbacks)
  }
  handleEvent(evt) {
    if (!this.startTime) {
      this.startTime = evt.playbackTime
      if (this.start_callback) {
        this.start_callback()
      }
    }

    const currentTime = evt.playbackTime - this.startTime
    const playbackDuration =
      this.scriptNode.bufferSize / this.context.sampleRate
    for (const entry of this.track_callbacks) {
      const timestamp = entry[0]
      const callbacks = entry[1]
      if (timestamp < currentTime) {
        this.track_callbacks.delete(timestamp)
      } else if (timestamp < currentTime + playbackDuration) {
        for (const cb of callbacks) {
          cb()
        }
        this.track_callbacks.delete(timestamp)
      }
    }

    let offset = 0
    while (this.samples_queue.length > 0 && offset < evt.target.bufferSize) {
      let chunk = this.samples_queue[0]
      const to_copy = chunk.subarray(0, evt.target.bufferSize - offset)
      if (evt.outputBuffer.copyToChannel) {
        evt.outputBuffer.copyToChannel(to_copy, 0, offset)
      } else {
        evt.outputBuffer.getChannelData(0).set(to_copy, offset)
      }
      offset += to_copy.length
      chunk = chunk.subarray(to_copy.length)
      if (chunk.length > 0) {
        this.samples_queue[0] = chunk
      } else {
        this.samples_queue.shift()
      }
    }

    if (this.samples_queue.length === 0 && this.closed) {
      if (this.end_callback) {
        this.end_callback(evt.playbackTime - this.startTime)
      }
      this.disconnect()
    }
  }
}
