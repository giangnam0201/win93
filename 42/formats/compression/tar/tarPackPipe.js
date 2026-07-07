import { Bytes } from "../../../lib/class/Bytes.js"
import { inNode } from "../../../api/env/runtime/inNode.js"
import { defer } from "../../../lib/type/promise/defer.js"
import { encodeTarHeader, encodePax } from "./encodeTarHeader.js"

const END_OF_TAR = new Uint8Array(1024)

const S_IFMT = 0xf0_00
const S_IFBLK = 0x60_00
const S_IFCHR = 0x20_00
const S_IFDIR = 0x40_00
const S_IFIFO = 0x10_00
const S_IFLNK = 0xa0_00

const overflow = async function (writer, size) {
  size &= 511
  if (size) await writer.write(END_OF_TAR.slice(0, 512 - size))
}

function modeToType(mode) {
  // prettier-ignore
  switch (mode & S_IFMT) {
    case S_IFBLK: return "block-device"
    case S_IFCHR: return "character-device"
    case S_IFDIR: return "directory"
    case S_IFIFO: return "fifo"
    case S_IFLNK: return "symlink"
    default: return "file"
  }
}

function normalizeHeader(header) {
  if (header.size === undefined || header.type === "symlink") header.size = 0
  header.type ??= modeToType(header.mode)
  header.mode ??= header.type === "directory" ? 0o755 : 0o644
  header.uid ??= 0
  header.gid ??= 0
  header.mtime ??= 0
  return header
}

async function writeHeader(writer, header) {
  if (!header.pax) {
    const buf = encodeTarHeader(normalizeHeader(header))
    if (buf) {
      await writer.write(buf)
      return
    }
  }

  const paxHeader = encodePax({
    name: header.name,
    linkname: header.linkname,
    pax: header.pax,
  })

  const newHeader = {
    ...header,
    name: "PaxHeader",
    size: paxHeader.length,
    type: "pax-header",
    linkname: header.linkname && "PaxHeader",
  }

  await writer.write(encodeTarHeader(normalizeHeader(newHeader)))
  await writer.write(paxHeader)
  await overflow(writer, paxHeader.length)

  newHeader.size = header.size
  newHeader.type = header.type
  await writer.write(encodeTarHeader(newHeader))
}

/**
 * @typedef {TransformStream & {
 *   add: Function,
 *   stream: Function,
 * }} TarPackStream
 */

export function tarPackPipe(options) {
  const ts = /** @type {TarPackStream} */ (new TransformStream())
  const isAbortError = (err) =>
    err?.name === "AbortError" ||
    err === options?.signal?.reason ||
    err === "User cancelled" ||
    err?.message === "User cancelled"

  let writer = ts.writable.getWriter()
  const queue = []

  ts.add = async function (header, file) {
    const prev = queue.at(-1)
    const busy = defer()
    queue.push(busy)
    try {
      await prev

      if (globalThis.Blob && header instanceof Blob) {
        file = header
        header = {}
      }

      file ??= header.file

      if (globalThis.Blob && file instanceof Blob) {
        header.size ??= file.size
        // @ts-ignore
        header.name ??= file.name
        // @ts-ignore
        header.mtime ??= file.lastModified

        await writeHeader(writer, header)
        writer.releaseLock()
        const pipeOptions = { preventClose: true }
        if (options?.signal) pipeOptions.signal = options.signal
        await file.stream().pipeTo(ts.writable, pipeOptions)
        writer = ts.writable.getWriter()
        await overflow(writer, header.size)
      } else if (file instanceof ReadableStream) {
        await writeHeader(writer, header)
        writer.releaseLock()
        const pipeOptions = { preventClose: true }
        if (options?.signal) pipeOptions.signal = options.signal
        await file.pipeTo(ts.writable, pipeOptions)
        writer = ts.writable.getWriter()
        await overflow(writer, header.size)
      } else {
        const buf = Bytes.from(file)
        header.size ??= buf.length
        await writeHeader(writer, header)
        await writer.write(buf.toUint8Array())
        await overflow(writer, header.size)
      }
    } catch (err) {
      if (!isAbortError(err)) throw err
    } finally {
      busy.resolve()
    }
  }

  ts.stream = function () {
    queueMicrotask(async () => {
      try {
        await Promise.all(queue)
        await writer.write(END_OF_TAR)
        await writer.close()
      } catch (err) {
        if (!isAbortError(err)) throw err
      }
    })

    return ts.readable
  }

  let { readable } = ts

  if (inNode) {
    readable = readable.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(new Uint8Array(chunk))
        },
      }),
    )
  }

  if (options?.gzip) {
    readable = readable.pipeThrough(new CompressionStream("gzip"))
  }

  Object.defineProperty(ts, "readable", { value: readable })

  return ts
}
