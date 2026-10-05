/* eslint-disable no-async-promise-executor */
import { getStemname } from "../../lib/syntax/path/getStemname.js"
import { ensureURL } from "../os/ensureURL.js"

/** @import {TypedArray} from "../../lib/type/any/isTypedArray.js" */

const rejectFont = async (url, reject, err) => {
  const { rejectAsset } = await import("./inc/rejectAsset.js")
  rejectAsset(reject, `Font not loaded correctly: ${err}`, url)
}

/**
 * @param {string | ArrayBuffer | TypedArray} src
 * @param {FontFaceDescriptors & {
 *   family?: string;
 *   ignoreFileSystem?: boolean
 * }} [options]
 * @returns {Promise<FontFace>}
 */
export async function loadFont(src, options) {
  let { family, ignoreFileSystem, ...descriptors } = options ?? {}

  let font

  if (typeof src === "string") {
    const url = await ensureURL(src, { ignoreFileSystem })
    family ??= getStemname(src)
    font = new FontFace(family, `url(${url})`, descriptors)
  } else {
    family ??= await import("../uid.js").then(({ uid }) => uid(8))
    font = new FontFace(family, src, descriptors)
  }

  return new Promise(async (resolve, reject) => {
    try {
      await font.load()
      document.fonts.add(font)
      resolve(font)
    } catch (err) {
      rejectFont(src, reject, err)
    }
  })
}
