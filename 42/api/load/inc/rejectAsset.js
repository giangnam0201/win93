import { shortenFilename } from "../../fs/normalizeFilename.js"
import { httpGet } from "../../http.js"
import { LoadError } from "./LoadError.js"

export function rejectAsset(reject, message, url, cause) {
  message = `${message}: ${shortenFilename(String(url))}`
  httpGet(url)
    .then(() => reject(new LoadError(message, { url, cause })))
    .catch(reject)
}
