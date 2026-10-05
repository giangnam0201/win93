import { Player } from "../Player.js"
import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"
import { EmscriptenFS } from "../../../../42/api/fs/class/EmscriptenFS.js"

// import chipImage from '../images/chip.png';

const fileExtensions = [
  "mdx", //
]

const MOUNTPOINT = "/mount/mdx"
const INT16_MAX = 2 ** 16 - 1

// Preserves leading and trailing slashes.
function pathJoin(...parts) {
  const sep = "/"
  const last = parts.length - 1
  return parts
    .map((part, i) => {
      if (i !== 0 && part.startsWith(sep)) part = part.slice(1)
      if (i !== last && part.endsWith(sep)) part = part.slice(0, -1)
      return part
    })
    .join(sep)
}

export class MDXPlayer extends Player {
  constructor(core, sampleRate, bufferSize = 2048, debug = false) {
    super(core, sampleRate, bufferSize, debug)

    // Initialize MDX filesystem
    this.FS = new EmscriptenFS(this.core.FS)
    this.FS.writeDir(MOUNTPOINT)
    // this.core.FS.mkdirTree(MOUNTPOINT)
    this.core.FS.mount(this.core.FS.filesystems.IDBFS, {}, MOUNTPOINT)

    this.name = "Sharp X68000 MDX Player"
    this.speed = 1
    this.mdxCtx = this.core._mdx_create_context()
    this.core._mdx_set_rate(this.sampleRate)
    this.core._mdx_set_dir(this.mdxCtx, MOUNTPOINT)
    this.fileExtensions = fileExtensions
    this.buffer = this.core._malloc(this.bufferSize * 4) // 2 ch, 16-bit
  }

  async loadData(data, filename) {
    // MDXPlayer reads song data from the Emscripten filesystem,
    // rather than loading bytes from memory like other players.
    // this.filepathMeta = Player.metadataFromFilepath(filename)
    const mdxFilename = pathJoin(MOUNTPOINT, filename)

    // First, write PDX sample files into Emscripten filesystem.
    await this.FS.ensureFile(mdxFilename, data)

    // const pdx = this.core.ccall(
    //   "mdx_get_pdx_filename",
    //   "string",
    //   ["number", "string"],
    //   [this.mdxCtx, mdxFilename],
    // )

    // if (pdx) {
    //   const dir = getDirname(filename)
    //   const pdxFilename = pathJoin(MOUNTPOINT, dir, pdx)
    //   // Force upper case in the URL, as the entire MDX archive is upper case.
    //   // MDX files were authored on old case-insensitive filesystems, but
    //   // the music server filesystem (and URLs in general) are case-sensitive.
    //   const pdxUrl = pathJoin(CATALOG_PREFIX, dir, pdx.toUpperCase())
    //   // Write MDX file into Emscripten filesystem.
    //   await this.FS.ensureFile(pdxFilename, pdxUrl)
    // }

    this.muteAudioDuringCall(this.audioNode, () => {
      const err = this.core.ccall(
        "mdx_open",
        "number",
        ["number", "string", "string"],
        [this.mdxCtx, mdxFilename, null],
      )

      if (err !== 0) {
        throw new Error(`mdx_load_file failed. error code: ${err}`)
      }

      this.core._mdx_set_speed(this.mdxCtx, this.speed)

      // Metadata
      const ptr = this.core._malloc(256)
      this.core._mdx_get_title(this.mdxCtx, ptr)
      const buf = this.core.HEAPU8.subarray(ptr, ptr + 256)
      const len = buf.indexOf(0)
      const title = new TextDecoder("shift-jis").decode(buf.subarray(0, len))
      this.metadata = { title: title || getBasename(filename) }

      this.resume()
      this.emit("playerStateUpdate", {
        ...this.getBasePlayerState(),
        isStopped: false,
      })
    })

    // return ensureEmscFileWithData(this.core, mdxFilename, data)
    //   .then(() => {
    //     const pdx = this.core.ccall(
    //       "mdx_get_pdx_filename",
    //       "string",
    //       ["number", "string"],
    //       [this.mdxCtx, mdxFilename],
    //     )
    //     if (pdx) {
    //       const pdxFilename = pathJoin(MOUNTPOINT, dir, pdx)
    //       // Force upper case in the URL, as the entire MDX archive is upper case.
    //       // MDX files were authored on old case-insensitive filesystems, but
    //       // the music server filesystem (and URLs in general) are case-sensitive.
    //       const pdxUrl = pathJoin(CATALOG_PREFIX, dir, pdx.toUpperCase())
    //       // Write MDX file into Emscripten filesystem.
    //       return ensureEmscFileWithUrl(this.core, pdxFilename, pdxUrl)
    //     }
    //   })
    //   .then(() => {
    //     this.muteAudioDuringCall(this.audioNode, () => {
    //       err = this.core.ccall(
    //         "mdx_open",
    //         "number",
    //         ["number", "string", "string"],
    //         [this.mdxCtx, mdxFilename, null],
    //       )

    //       if (err !== 0) {
    //         throw new Error(`mdx_load_file failed. error code: ${err}`)
    //       }

    //       this.core._mdx_set_speed(this.mdxCtx, this.speed)

    //       // Metadata
    //       const ptr = this.core._malloc(256)
    //       this.core._mdx_get_title(this.mdxCtx, ptr)
    //       const buf = this.core.HEAPU8.subarray(ptr, ptr + 256)
    //       const len = buf.indexOf(0)
    //       const title = new TextDecoder("shift-jis").decode(
    //         buf.subarray(0, len),
    //       )
    //       this.metadata = { title: title || getBasename(filename) }

    //       this.resume()
    //       this.emit("playerStateUpdate", {
    //         ...this.getBasePlayerState(),
    //         isStopped: false,
    //       })
    //     })
    //   })
  }

  processAudioInner(channels) {
    let i
    let ch

    if (this.paused) {
      for (ch = 0; ch < channels.length; ch++) channels[ch].fill(0)
      return
    }

    const next = this.core._mdx_calc_sample(
      this.mdxCtx,
      this.buffer,
      this.bufferSize,
    )
    if (next === 0) {
      this.stop()
    }

    for (ch = 0; ch < channels.length; ch++) {
      for (i = 0; i < this.bufferSize; i++) {
        channels[ch][i] =
          this.core.getValue(
            this.buffer + // Interleaved channel format
              i * 2 * 2 + // frame offset   * bytes per sample * num channels +
              ch * 2, //     channel offset * bytes per sample
            "i16", //        the sample values are signed 16-bit integers
          ) / INT16_MAX
      }
    }
  }

  getTempo() {
    return this.speed
  }

  setTempo(val) {
    this.speed = val
    return this.core._mdx_set_speed(this.mdxCtx, val)
  }

  getPositionMs() {
    return this.core._mdx_get_position_ms(this.mdxCtx)
  }

  getDurationMs() {
    return this.core._mdx_get_length(this.mdxCtx) * 1000
  }

  getMetadata() {
    return this.metadata
  }

  isPlaying() {
    return !this.isPaused()
  }

  getVoiceName(index) {
    if (this.mdxCtx) {
      return this.core.UTF8ToString(
        this.core._mdx_get_track_name(this.mdxCtx, index),
      )
    }
  }

  getNumVoices() {
    if (this.mdxCtx) return this.core._mdx_get_tracks(this.mdxCtx)
  }

  getVoiceGroups() {
    if (!this.mdxCtx) return []
    const voiceGroups = []
    const numVoices = this.core._mdx_get_tracks(this.mdxCtx)
    let currGroup
    for (let i = 0; i < numVoices; i++) {
      const voiceName = this.core.UTF8ToString(
        this.core._mdx_get_track_name(this.mdxCtx, i),
      )
      if (i === 0) {
        currGroup = {
          name: "YM2151 (OPM)",
          // icon: chipImage,
          voices: [],
        }
        voiceGroups.push(currGroup)
      }
      if (i === 8) {
        currGroup = {
          name: numVoices === 9 ? "OKI MSM6258" : "Mercury Unit (PCM8)",
          // icon: chipImage,
          voices: [],
        }
        voiceGroups.push(currGroup)
      }
      currGroup.voices.push({
        idx: i,
        name: voiceName,
      })
    }
    return voiceGroups
  }

  getVoiceMask() {
    const voiceMask = []
    const mask = this.core._mdx_get_track_mask(this.mdxCtx)
    for (let i = 0; i < this.core._mdx_get_tracks(this.mdxCtx); i++) {
      voiceMask.push(((mask >> i) & 1) === 0)
    }
    return voiceMask
  }

  setVoiceMask(voiceMask) {
    let mask = 0
    voiceMask.forEach((isEnabled, i) => {
      if (!isEnabled) {
        mask += 1 << i
      }
    })
    if (this.mdxCtx) this.core._mdx_set_track_mask(this.mdxCtx, mask)
  }

  seekMs(seekMs) {
    this.muteAudioDuringCall(this.audioNode, () =>
      this.core._mdx_set_position_ms(this.mdxCtx, seekMs),
    )
  }

  stop() {
    this.suspend()
    this.core._mdx_close(this.mdxCtx)
    console.debug("-- MDXPlayer stop --")
    this.emit("playerStateUpdate", { isStopped: true })
  }
}
