// @src https://github.com/LinusU/decode-ico

// TODO: add encode https://github.com/kettek/ico-endec-js/tree/master
// TODO: add extractor https://github.com/jlu5/icoextract/tree/master https://www.aha-soft.com/extract-icon/dcr-icon-extractor.htm

import { decodeBmp } from "./BMP.js"
import { blobToImageData } from "../../lib/graphic/imageDataToBlob.js"

function isPng(view, offset) {
  return (
    view.getUint32(offset + 0) === 0x89_50_4e_47 &&
    view.getUint32(offset + 4) === 0x0d_0a_1a_0a
  )
}

function pngBitsPerPixel(view, offset) {
  const bitDepth = view.getUint8(offset + 24)
  const colorType = view.getUint8(offset + 25)

  if (colorType === 0) return Number(bitDepth)
  if (colorType === 2) return bitDepth * 3
  if (colorType === 3) return Number(bitDepth)
  if (colorType === 4) return bitDepth * 2
  if (colorType === 6) return bitDepth * 4

  throw new Error("Invalid PNG colorType")
}

function pngWidth(view, offset) {
  return view.getUint32(offset + 16, false)
}

function pngHeight(view, offset) {
  return view.getUint32(offset + 20, false)
}

async function returnPng(view, offset = 0, hotspot, size) {
  const w = pngWidth(view, offset)
  const h = pngHeight(view, offset)
  const data = new Uint8Array(
    view.buffer,
    view.byteOffset + offset,
    size ?? view.byteLength,
  )

  const blob = new Blob([data])
  const imageData = await blobToImageData(blob)

  return {
    width: w,
    height: h,
    bpp: pngBitsPerPixel(view, offset),
    type: "png",
    hotspot,
    imageData,
    getBlob: async () => blob,
    getDataURL: async () => {
      const { imageDataToDataURL } = await import(
        "../../lib/graphic/imageDataToBlob.js"
      )
      return imageDataToDataURL(imageData)
    },
  }
}

export async function decodeIco(input) {
  const view =
    input instanceof ArrayBuffer
      ? new DataView(input)
      : new DataView(input.buffer, input.byteOffset, input.byteLength)

  if (view.byteLength < 6) {
    throw new Error("Truncated header")
  }

  if (isPng(view, 0)) {
    // the file is actually a png masquerading as an ico
    return [await returnPng(view)]
  }

  if (view.getUint16(0, true) !== 0) {
    throw new Error("Invalid magic bytes")
  }

  const type = view.getUint16(2, true)

  if (type !== 1 && type !== 2) {
    throw new Error("Invalid image type")
  }

  const length = view.getUint16(4, true)

  if (view.byteLength < 6 + 16 * length) {
    throw new Error("Truncated image list")
  }

  return Promise.all(
    Array.from({ length }, (_, idx) => {
      const width = view.getUint8(6 + 16 * idx + 0)
      const height = view.getUint8(6 + 16 * idx + 1)
      const size = view.getUint32(6 + 16 * idx + 8, true)
      const offset = view.getUint32(6 + 16 * idx + 12, true)

      const hotspot =
        type === 2
          ? {
              x: view.getUint16(6 + 16 * idx + 4, true),
              y: view.getUint16(6 + 16 * idx + 6, true),
            }
          : null

      if (isPng(view, offset)) {
        return returnPng(view, offset, hotspot, size)
      }

      const data = new Uint8Array(view.buffer, view.byteOffset + offset, size)
      const bmp = decodeBmp(data, { width, height, icon: true })

      const { imageData } = bmp
      // const imageData = new ImageData(bmp.imageData.data, bmp.width, bmp.height)

      return {
        width: imageData.width,
        height: imageData.height,
        bpp: bmp.colorDepth,
        type: "bmp",
        hotspot,
        imageData,
        getBlob: async () => {
          const { imageDataToBlob } = await import(
            "../../lib/graphic/imageDataToBlob.js"
          )
          return imageDataToBlob(imageData)
        },
        getDataURL: async () => {
          const { imageDataToDataURL } = await import(
            "../../lib/graphic/imageDataToBlob.js"
          )
          return imageDataToDataURL(imageData)
        },
      }
    }),
  )
}

export const ICO = {
  decode: decodeIco,
}
