import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { noop } from "../../lib/type/function/noop.js"
import { parseWebStream, selectCover } from "./parseAudioMetadata.js"

export async function audioMetadata(source) {
  if (isInstanceOf(source, Blob)) {
    source = source.stream()
  }

  const { common, format } = await parseWebStream(source)

  common.format = format

  common.getCoverBlob = () => {
    const cover = selectCover(common.picture)
    if (!cover) return
    return new Blob([cover.data])
  }

  common.getCover = () => {
    const cover = selectCover(common.picture)
    if (!cover) return

    const blob = new Blob([cover.data])
    const img = new Image()
    img.src = URL.createObjectURL(blob)
    img
      .decode()
      .catch(noop)
      .finally(() => URL.revokeObjectURL(img.src))

    return img
  }

  return common
}
