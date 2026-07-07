let compressModule
let decompressModule

/**
 * @param {Function} createModule
 * @returns {Promise<any>}
 */
function init(createModule) {
  return new Promise((resolve) => {
    const m = createModule({
      onRuntimeInitialized: () => resolve(m),
    })
  })
}

/**
 * @param {Uint8Array} buffer
 * @returns {Promise<Uint8Array>}
 */
export async function compress(buffer) {
  compressModule ??= await init(
    await import("./wawoff2-compress-binding.js").then((m) => m.default),
  )
  const result = compressModule.compress(buffer)
  if (result === false) throw new Error("ConvertTTFToWOFF2 failed")
  return new Uint8Array(result)
}

/**
 * @param {Uint8Array} buffer
 * @returns {Promise<Uint8Array>}
 */
export async function decompress(buffer) {
  decompressModule ??= await init(
    await import("./wawoff2-decompress-binding.js").then((m) => m.default),
  )
  const result = decompressModule.decompress(buffer)
  if (result === false) throw new Error("ConvertWOFF2ToTTF failed")
  return new Uint8Array(result)
}
