export async function untilDocumentReady(doc = document) {
  if (doc.readyState === "complete") return

  return new Promise((resolve) => {
    const handler = () => {
      if (doc.readyState === "complete") {
        resolve()
        doc.removeEventListener("readystatechange", handler)
      }
    }

    doc.addEventListener("readystatechange", handler)
  })
}
