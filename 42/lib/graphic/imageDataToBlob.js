/**
 * @param {ImageData} imageData
 */
export function imageDataToCanvas(imageData) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext("2d")
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * @param {ImageData} imageData
 * @param {{ type?: string; quality?: number; }} [options]
 */
export function imageDataToDataURL(imageData, options) {
  const canvas = imageDataToCanvas(imageData)
  const type = options?.type ?? "image/png"
  const quality = options?.quality
  return canvas.toDataURL(type, quality)
}

/**
 * @param {ImageData} imageData
 * @param {{ type?: string; quality?: number; }} [options]
 */
export async function imageDataToBlob(imageData, options) {
  const canvas = imageDataToCanvas(imageData)
  const type = options?.type ?? "image/png"
  const quality = options?.quality
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * @param {Blob | File} blob
 */
export async function blobToImageData(blob) {
  const url = URL.createObjectURL(blob)
  const img = new Image()

  img.src = url
  await img.decode()
  URL.revokeObjectURL(img.src)

  const { height, width } = img
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, width, height)
}
