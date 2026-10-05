import { isInstanceOf } from "./isInstanceOf.js"

export const PRIMITIVES = new Set([
  "boolean", //
  "string",
  "number",
  "bigint",
])

export const SERIALIZABLES = new Set([
  // @src https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#supported_types
  "Array",
  "ArrayBuffer",
  "Boolean",
  "DataView",
  "Date",
  // "Error",
  "Map",
  "Number",
  "Object",
  "RegExp",
  "Set",
  "String",
  // @src https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#webapi_types
  "AudioData",
  "Blob",
  "CropTarget",
  "CryptoKey",
  "DOMException",
  "DOMMatrix",
  "DOMMatrixReadOnly",
  "DOMPoint",
  "DOMPointReadOnly",
  "DOMQuad",
  "DOMRect",
  "DOMRectReadOnly",
  "File",
  "FileList",
  "FileSystemDirectoryHandle",
  "FileSystemFileHandle",
  "FileSystemHandle",
  "GPUCompilationInfo",
  "GPUCompilationMessage",
  "ImageBitmap",
  "ImageData",
  "RTCCertificate",
  "VideoFrame",
])

/**
 * @param {any} val
 * @returns {boolean}
 */
export function isSerializable(val) {
  if (!val) return true
  const type = typeof val
  if (PRIMITIVES.has(type)) return true
  if (type !== "object") return false
  if (ArrayBuffer.isView(val) || isInstanceOf(val, Error)) return true
  const tag = val.constructor?.name
  return SERIALIZABLES.has(tag)
}
