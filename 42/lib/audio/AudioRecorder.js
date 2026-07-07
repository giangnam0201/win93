import { WAV } from "../../formats/codec/WAV.js"

export class AudioRecorder {
  constructor(context) {
    this.context = context
  }

  isRecording = false
  connectedNodes = new Set()

  async record(audioNode, options) {
    this.isRecording = true

    if (this.dest) {
      for (const connectedNode of this.connectedNodes) {
        try {
          connectedNode.disconnect(this.dest)
        } catch {}
      }
    }

    this.dest = new MediaStreamAudioDestinationNode(this.context)
    audioNode.connect(this.dest)
    this.connectedNodes.add(audioNode)

    let defaultMimeType = "audio/webm;codecs=pcm"
    defaultMimeType = MediaRecorder.isTypeSupported(defaultMimeType)
      ? defaultMimeType
      : "audio/webm"

    const mimeType =
      options?.mimeType &&
      options?.mimeType !== "audio/webm" &&
      MediaRecorder.isTypeSupported(options.mimeType)
        ? options?.mimeType
        : defaultMimeType

    const desiredMimeType = options?.mimeType?.startsWith("audio/webm")
      ? mimeType
      : (options?.mimeType ?? "audio/wav")

    const chunks = []

    if (!(desiredMimeType === mimeType || desiredMimeType === "audio/wav")) {
      throw new Error(`Unsupported mimetype: ${desiredMimeType}`)
    }

    return new Promise((resolve) => {
      this.mediaRecorder = new MediaRecorder(this.dest.stream, { mimeType })
      this.mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      this.mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          this.isRecording = false
          this.connectedNodes.delete(audioNode)
          const type = mimeType.split(";")[0]
          const blob = new Blob(chunks, { type })
          if (desiredMimeType === mimeType) {
            resolve(blob)
          } else if (desiredMimeType === "audio/wav") {
            const audioContext = this.context
            WAV.encode(blob, { audioContext }).then(resolve)
          }
        }
      }
      this.mediaRecorder.start()
    })
  }

  stop() {
    this.isRecording = false
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
  }
}
