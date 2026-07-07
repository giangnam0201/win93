/**
 * WOFF v1 conversion using browser-native CompressionStream.
 */

const getU32 = (buf, off) =>
  new DataView(buf.buffer, buf.byteOffset + off, 4).getUint32(0)
const getU16 = (buf, off) =>
  new DataView(buf.buffer, buf.byteOffset + off, 2).getUint16(0)

const fourByteAlign = (n) => (n + 3) & ~3

function pad(buf, len) {
  const aligned = fourByteAlign(len)
  if (aligned === buf.length) return buf
  const out = new Uint8Array(aligned)
  out.set(buf)
  return out
}

async function zlib(data, mode) {
  const stream =
    mode === "inflate"
      ? new DecompressionStream("deflate")
      : new CompressionStream("deflate")
  const writer = stream.writable.getWriter()
  writer.write(data)
  writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

export async function toWoff(sfnt) {
  const numTables = getU16(sfnt, 4)
  const flavor = getU32(sfnt, 0)
  const tables = []
  let totalSfntSize = 12 + numTables * 16

  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16
    tables.push({
      tag: getU32(sfnt, off),
      checksum: getU32(sfnt, off + 4),
      offset: getU32(sfnt, off + 8),
      length: getU32(sfnt, off + 12),
    })
  }
  tables.sort((a, b) => a.tag - b.tag)

  let woffOffset = 44 + numTables * 20
  const woffTableData = []
  const woffTableDir = new Uint8Array(numTables * 20)
  const dvDir = new DataView(woffTableDir.buffer)

  for (let i = 0; i < numTables; i++) {
    const t = tables[i]
    totalSfntSize += fourByteAlign(t.length)
    const slice = sfnt.subarray(t.offset, t.offset + t.length)
    const comp = await zlib(slice, "deflate")
    const useComp = comp.length < t.length
    const finalData = useComp ? comp : slice
    const padded = pad(finalData, finalData.length)

    dvDir.setUint32(i * 20, t.tag)
    dvDir.setUint32(i * 20 + 4, woffOffset)
    dvDir.setUint32(i * 20 + 8, finalData.length)
    dvDir.setUint32(i * 20 + 12, t.length)
    dvDir.setUint32(i * 20 + 16, t.checksum)

    woffOffset += padded.length
    woffTableData.push(padded)
  }

  const out = new Uint8Array(woffOffset)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x77_4f_46_46)
  dv.setUint32(4, flavor)
  dv.setUint32(8, woffOffset)
  dv.setUint16(12, numTables)
  dv.setUint32(16, totalSfntSize)

  out.set(woffTableDir, 44)
  let cur = 44 + numTables * 20
  for (const data of woffTableData) {
    out.set(data, cur)
    cur += data.length
  }
  return out
}

export async function toSfnt(woff) {
  const numTables = getU16(woff, 12)
  const flavor = getU32(woff, 4)
  const nearestPow2 = 2 ** Math.floor(Math.log2(numTables))

  const tables = []
  for (let i = 0; i < numTables; i++) {
    const off = 44 + i * 20
    const dvW = new DataView(woff.buffer, woff.byteOffset + off, 20)
    tables.push({
      tag: dvW.getUint32(0),
      offset: dvW.getUint32(4),
      compLen: dvW.getUint32(8),
      origLen: dvW.getUint32(12),
      checksum: dvW.getUint32(16),
    })
  }

  let sfntOffset = 12 + numTables * 16
  const sfntTableData = []
  const sfntTableDir = new Uint8Array(numTables * 16)
  const dvDir = new DataView(sfntTableDir.buffer)

  for (let i = 0; i < numTables; i++) {
    const t = tables[i]
    let data = woff.subarray(t.offset, t.offset + t.compLen)
    if (t.compLen !== t.origLen) {
      try {
        data = await zlib(data, "inflate")
      } catch (err) {
        console.error(
          `Failed to inflate table ${t.tag.toString(16)}: ${
            err.message
          }. Prefix: ${data[0].toString(16)} ${data[1].toString(16)}`,
        )
        throw err
      }
    }

    const padded = pad(data, data.length)
    dvDir.setUint32(i * 16, t.tag)
    dvDir.setUint32(i * 16 + 4, t.checksum)
    dvDir.setUint32(i * 16 + 8, sfntOffset)
    dvDir.setUint32(i * 16 + 12, t.origLen)

    sfntOffset += padded.length
    sfntTableData.push(padded)
  }

  const out = new Uint8Array(sfntOffset)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, flavor)
  dv.setUint16(4, numTables)
  dv.setUint16(6, nearestPow2 * 16)
  dv.setUint16(8, Math.log2(nearestPow2))
  dv.setUint16(10, numTables * 16 - nearestPow2 * 16)

  out.set(sfntTableDir, 12)
  let cur = 12 + numTables * 16
  for (const data of sfntTableData) {
    out.set(data, cur)
    cur += data.length
  }
  return out
}
