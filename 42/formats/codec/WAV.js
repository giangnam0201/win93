import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { audioBufferToWavBuffer } from "./wav/audioBufferToWavBuffer.js"

export async function encode(data, options) {
  let audioContext
  let arrayBuffer
  let audioBuffer

  if (isInstanceOf(data, AudioBuffer)) {
    audioBuffer = data
  } else if (isInstanceOf(data, ArrayBuffer)) {
    arrayBuffer = data
  } else if (isInstanceOf(data, Blob)) {
    arrayBuffer = await data.arrayBuffer()
  }

  if (!audioBuffer) {
    if (!arrayBuffer) throw new Error("Missing data")
    audioContext = options?.audioContext ?? new AudioContext()
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  }

  const wavBuffer = await audioBufferToWavBuffer(audioBuffer, options)
  if (options?.returnArrayBuffer) return wavBuffer
  return new Blob([wavBuffer], { type: "audio/wav" })
}

export const WAV = { encode }
