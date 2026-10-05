import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { setFileRelativePath } from "./setFileRelativePath.js"

export async function responseToFile(res, filename) {
  const type = res.headers.get("Content-Type")?.split(";")[0] || undefined
  const lastModifiedString = res.headers.get("Last-Modified") || undefined
  const lastModified = new Date(lastModifiedString).getTime()
  const basename = getBasename(filename ?? new URL(res.url, "file:").pathname)
  const arrayBuffer = await res.arrayBuffer()
  const file = new File([arrayBuffer], basename, { type, lastModified })
  if (filename) setFileRelativePath(file, filename)
  return file
}
