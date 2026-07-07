import { clipboard } from "../../../../42/api/io/clipboard.js"
import { blobToDataURL } from "../../../../42/lib/type/binary/blobToDataURL.js"
import { bytesize } from "../../../../42/lib/type/binary/bytesize.js"
import { confirm } from "../../../../42/ui/layout/dialog.js"

/**
 * @param {import("42/api/os/App.js").App} app
 */
export function renderApp(app) {
  let textareaEl

  app
    .once("ready", () => {
      textareaEl = app.el.querySelector("textarea")
      textareaEl.onfocus = () => textareaEl.select()
      if (!app.file) textareaEl.removeAttribute("aria-busy")
    })
    .on("decode", async (fileAgent) => {
      const blob = await fileAgent.getBlob()

      if (blob.size > 1_024_000) {
        const ok = await confirm(
          `%md File weighs ${bytesize(blob.size)}, displaying it can be slow.  \nAre you sure ?  \n`,
          {
            icon: "warning",
            beforeDecline: {
              tag: "button",
              content: "Copy to clipboard",
              onclick: async (e) => {
                const dialogEl = e.target.closest("ui-dialog")
                dialogEl?.close()
                clipboard.copy(await blobToDataURL(blob), { notif: true })
              },
            },
          },
        )

        if (!ok) {
          app.destroy()
          return
        }
      }

      textareaEl.value = await blobToDataURL(blob)
      textareaEl.removeAttribute("aria-busy")
    })
    .on("encode", () => textareaEl.value)

  if (!app.file) app.openFile()

  return {
    class: "overlap fit",
    content: [
      {
        tag: "textarea.fit.font-mono",
        aria: { busy: true },
      },
      {
        content: {
          tag: "button.center-self.pa.z-focused",
          content: "Copy to clipboard",
          picto: "clipboard",
          onclick: async () => {
            clipboard.copy(textareaEl.value, { notif: true })
            app.destroy()
          },
        },
      },
    ],
  }
}
