import { encodeWAV } from "./audioBufferToWavBuffer.js"

self.onmessage = function ({ data }) {
  const buffer = encodeWAV(...data)
  self.postMessage(buffer, [buffer])
  self.close()
}
