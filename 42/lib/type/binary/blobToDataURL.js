/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () =>
      fr.readyState === 2 && resolve(/** @type string */ (fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function blobToBinaryString(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () =>
      fr.readyState === 2 && resolve(/** @type string */ (fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsBinaryString(blob)
  })
}
