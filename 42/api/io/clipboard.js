import { truncate } from "../../lib/type/string/truncate.js"
import { toast } from "../../ui/layout/toast.js"

export const copy = async (text, options) => {
  await navigator.clipboard.writeText(text)

  if (options?.notif) {
    const type = typeof options.notif
    const notif = type === "function" ? options.notif : toast
    notif(
      type === "string"
        ? options.notif
        : `%md **Copied to clipboard**  \n"${truncate(text, 25)}"`,
      { picto: "clipboard" },
    )
  }
}

export const paste = async () => navigator.clipboard.readText()

export const clipboard = {
  copy,
  paste,
}
