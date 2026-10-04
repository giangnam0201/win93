import { wrapCursor } from "../../lib/dom/cursor.js"
import { listenEventMap } from "../../lib/event/on.js"
import { dataTransfertImport } from "./dataTransfertImport.js"

/**
 * @typedef {(e: DragEvent) => void} DragEventCallback
 * @typedef {(imports: ReturnType<typeof dataTransfertImport>, e: DragEvent) => void} DropCallback
 */

/**
 * @param {{
 *   start?: DragEventCallback;
 *   drag?: DragEventCallback;
 *   stop?: DragEventCallback;
 *   drop?: DropCallback;
 *   signal?: AbortSignal;
 * }} init
 */
export function dragEntrance(init) {
  let cnt = 0
  return listenEventMap({
    prevent: true,
    signal: init.signal,

    dragenter(e) {
      e.dataTransfer.dropEffect = "none" // prevent dropEffect flickering
      if (cnt === 0) init.start?.(e)
      cnt++
    },

    dragleave(e) {
      cnt--
      if (cnt === 0) init.stop?.(e)
    },

    dragover(e) {
      init.drag?.(e)
    },

    async drop(e) {
      cnt = 0
      if (init.drop) {
        const importsPromise = dataTransfertImport(e)
        await wrapCursor(
          "wait", //
          async () => init.drop(await importsPromise, e),
        )
      }
      init.stop?.(e)
    },
  })
}
