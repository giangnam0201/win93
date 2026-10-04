import { tarExtractPipe } from "./tarExtractPipe.js"
import { http } from "../../../api/http.js"

export async function extract(src, options) {
  const items = []

  const source =
    typeof src === "string" //
      ? http.source(src)
      : "stream" in src
        ? src.stream()
        : src

  await source.pipeThrough(tarExtractPipe(options)).pipeTo(
    new WritableStream({
      write: (data) => {
        const item = { ...data }
        if (item.type === "file") item.file = data.file
        items.push(item)
      },
    }),
  )

  return items
}
