import { noop } from "../../../../../42/lib/type/function/noop.js"

class SamplesQueue {
  /** @type Float32Array[] */
  samplesQueue = []

  /**
   * @param {Float32Array} samples
   */
  push(samples) {
    this.samplesQueue.push(samples)
  }

  length() {
    let total = 0
    for (const next of this.samplesQueue) {
      total += next.length
    }
    return total
  }

  /**
   * @param {Float32Array} dst
   * @param {number} bufferSize
   */
  writeTo(dst, bufferSize) {
    let writeIt = 0
    while (this.samplesQueue.length > 0) {
      const src = this.samplesQueue[0]
      const toRead = Math.min(bufferSize - writeIt, src.length)
      if (toRead === src.length) {
        dst.set(src, writeIt)
        this.samplesQueue.shift()
      } else {
        dst.set(src.slice(0, toRead), writeIt)
        this.samplesQueue[0] = src.slice(toRead)
      }

      writeIt += toRead

      if (writeIt === bufferSize) {
        break
      }
    }

    if (writeIt < bufferSize) {
      dst.fill(0, writeIt)
    }
  }
}

export function renderAudio(ci, events) {
  const sampleRate = ci.soundFrequency()
  const channels = 1

  if (sampleRate === 0) {
    console.warn("Can't create audio node with sampleRate === 0, ingnoring")
    return () => {}
  }

  // console.log({ sampleRate })
  let audioContext = new AudioContext({
    sampleRate,
    latencyHint: "interactive",
  })

  const samplesQueue = new SamplesQueue()
  const bufferSize = 2048
  const preBufferSize = 2048

  events.onSoundPush((samples) => {
    // console.log(111, samples)
    if (samplesQueue.length() < bufferSize * 2 + preBufferSize) {
      samplesQueue.push(samples)
    }
  })

  const audioNode = audioContext.createScriptProcessor(bufferSize, 0, channels)
  let started = false

  const onQueueProcess = (event) => {
    const numFrames = event.outputBuffer.length
    const numChannels = event.outputBuffer.numberOfChannels
    const samplesCount = samplesQueue.length()

    if (!started) {
      started = samplesCount >= preBufferSize
    }

    if (!started) {
      return
    }

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = event.outputBuffer.getChannelData(channel)
      samplesQueue.writeTo(channelData, numFrames)
    }
  }

  audioNode.onaudioprocess = onQueueProcess

  audioNode.connect(audioContext.destination)

  return () => {
    events.onSoundPush(noop)
    audioNode.disconnect()
    audioContext.close().catch(console.log)
    audioContext = null
  }
}
