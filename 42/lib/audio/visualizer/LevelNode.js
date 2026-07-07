import { AudioProcessorNode, AudioProcessor } from "../AudioProcessorNode.js"

/* MARK: Node
------------- */

export class LevelNode extends AudioProcessorNode {
  static module = import.meta.url

  constructor(context, parameterData) {
    super(context, "level", {
      parameterData,
      channelCountMode: "explicit",
    })
  }
}

/* MARK: Processor
------------------ */

// https://observablehq.com/@radames/audio-worklet-volume-monitoring-rms
// https://github.com/chrisguttandin/web-audio-conference-2024
// https://github.com/GoogleChromeLabs/web-audio-samples/blob/main/src/audio-worklet/basic/volume-meter/volume-meter-processor.js

// TODO: check this
// https://codepen.io/TF3RDL/pen/gONWJby
// https://hydrogenaud.io/index.php/topic,126685.0.html

class LevelProcessor extends AudioProcessor {
  peakSmoothing = 0.98
  rmsSmoothing = 0.97

  interval = 1 / 60
  lastUpdate = currentTime

  data = []

  /**
   * @param {Float32Array[][]} inputs
   */
  process([input]) {
    if (input.length === 0) return this.running

    if (this.data.length !== input.length) {
      this.data.length = input.length
      for (let i = 0, l = this.data.length; i < l; i++) {
        this.data[i] = { peak: 0, rms: 0 }
      }
    }

    for (let channel = 0, l = input.length; channel < l; channel++) {
      const samples = input[channel]
      let sum = 0
      let peak = 0

      for (let i = 0; i < 128; i++) {
        const sample = samples[i]
        // Guard against NaN/Infinity
        if (!Number.isFinite(sample)) continue
        peak = Math.max(peak, Math.abs(sample))
        sum += sample ** 2
      }

      // Calculate the RMS level and update the volume
      let rms = Math.sqrt(sum / samples.length)

      // Smooth with fast attack and slow release
      peak = Math.max(peak, this.data[channel].peak * this.peakSmoothing)
      rms = Math.max(rms, this.data[channel].rms * this.rmsSmoothing)

      this.data[channel].peak = peak
      this.data[channel].rms = rms
    }

    if (currentTime - this.lastUpdate > this.interval) {
      this.port.postMessage(this.data)
      this.lastUpdate = currentTime
    }

    return this.running
  }
}

AudioProcessor.define("level", LevelProcessor)
