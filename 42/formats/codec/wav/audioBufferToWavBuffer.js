//! Copyright (c) 2015 Jam3. MIT License.
// @src https://github.com/Experience-Monks/audiobuffer-to-wav

function writeFloat32(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 4) {
    view.setFloat32(offset, input[i], true)
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x80_00 : s * 0x7f_ff, true)
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length
  const result = new Float32Array(length)

  let index = 0
  let inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

export function encodeWAV(channels, format, sampleRate, bitDepth) {
  const numberOfChannels = channels.length

  const samples =
    numberOfChannels === 2 ? interleave(channels[0], channels[1]) : channels[0]

  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample

  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, "RIFF")
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  /* RIFF type */
  writeString(view, 8, "WAVE")
  /* format chunk identifier */
  writeString(view, 12, "fmt ")
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format, true)
  /* channel count */
  view.setUint16(22, numberOfChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, "data")
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true)

  if (format === 1) {
    floatTo16BitPCM(view, 44, samples)
  } else {
    writeFloat32(view, 44, samples)
  }

  return buffer
}

export function audioBufferToWavBuffer(audioBuffer, options) {
  const { numberOfChannels, sampleRate } = audioBuffer
  const format = options?.float32 ? 3 : 1
  const bitDepth = format === 3 ? 32 : 16

  const channels =
    numberOfChannels === 2
      ? [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)]
      : [audioBuffer.getChannelData(0)]

  if (options?.worker === false) {
    return encodeWAV(channels, format, sampleRate, bitDepth)
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(import.meta.resolve("./wav.w.js"), {
      type: "module",
    })

    worker.onerror = () => reject(new Error("Wave Worker failed"))
    worker.onmessage = (e) => resolve(e.data)

    const transfer = []
    for (let i = 0; i < numberOfChannels; i++) transfer.push(channels[i].buffer)

    worker.postMessage([channels, format, sampleRate, bitDepth], transfer)
  })
}
