import "../../ui/layout/listbox.js"
import "../../ui/layout/tabs.js"
import { dialog } from "../../ui/layout/dialog.js"
import { getPaletteHistory } from "./paletteHistory.js"

/**
 * Pick or launch an effect without changing the selected cable.
 * @param {object} edge
 * @param {{
 *   signal: AbortSignal,
 *   mixer: import("../../lib/audio/mixer.js").AudioMixer,
 *   position?: {x: number, y: number},
 * }} options
 */
export async function selectAudioEffect(edge, { signal, mixer, position }) {
  const { os } = await import("../os.js")
  const appsManager = os.apps
  await appsManager.ready
  const history = await getPaletteHistory()
  if (signal.aborted) return
  let resolve
  let reject
  let picking = false
  let preserve = false
  const result = new Promise((done, fail) => {
    resolve = done
    reject = fail
  })
  const choose = async (item) => {
    if (picking) return
    picking = true
    const keepConnections = preserve
    pickerEl.close()
    try {
      let { track } = item
      if (!track) {
        const app = await appsManager.launch(item.name, { audioInput: false })
        await app.ready
        await app.trackReady
        track = app.track
        if (position && !signal.aborted && app.dialogEl?.isConnected) {
          // Add the header ports before measuring the window's final size.
          mixer.patchView?.sync()
          const el = app.dialogEl
          const bounds = el.workspace.getBoundingClientRect()
          el.x = Math.max(
            0,
            Math.min(
              position.x - bounds.left - el.offsetWidth / 2,
              el.workspace.clientWidth - el.offsetWidth,
            ),
          )
          el.y = Math.max(
            0,
            Math.min(
              position.y - bounds.top - el.offsetHeight / 2,
              el.workspace.clientHeight - el.offsetHeight,
            ),
          )
          el.updatePosition()
        }
      }
      resolve({ track, preserve: keepConnections })
    } catch (error) {
      reject(error)
    }
  }
  const tab = (label, content, useHistory) => {
    let listboxEl
    return {
      label,
      content: [
        {
          tag: "input",
          aria: { label: `Filter ${label.toLowerCase()}` },
          // placeholder: "Filter effects",
          autofocus: useHistory,
          on: {
            input: (event, target) => {
              listboxEl.search = target.value
            },
            keydown: (event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                listboxEl[
                  event.key === "ArrowDown" ? "highlightNext" : "highlightPrev"
                ]()
              } else if (event.key === "Enter") {
                event.preventDefault()
                preserve = event.ctrlKey
                listboxEl.pick(listboxEl.current)
              }
            },
          },
        },
        {
          tag: "ui-listbox.inset.scroll-y-auto.w-full.grow",
          css: "& { min-block-size: 160px; max-block-size: 320px; }",
          content: (el) => {
            if (useHistory) el.history = history
            return typeof content === "function" ? content() : content
          },
          fuzzy: true,
          frecency: useHistory,
          limit: Infinity,
          captureKeydown: false,
          created: (el) => {
            listboxEl = el
            for (const type of ["pointerdown", "keydown"]) {
              el.addEventListener(
                type,
                (event) => {
                  preserve = event.ctrlKey
                },
                { capture: true, signal: el.signal },
              )
            }
          },
          on: {
            "ui:listbox.pick": ({ detail }) => choose(detail),
          },
        },
      ],
    }
  }
  const opened = () =>
    [...mixer.effectTracks.values()]
      .filter(
        (track) =>
          track !== edge.source &&
          track !== edge.target &&
          track.hasAudioOutput !== false &&
          !track.willDestroy,
      )
      .map((track) => ({ label: track.name, picto: track.picto, track }))
  const pickerEl = await dialog({
    label: "Insert effect",
    picto: "plus",
    style: { minWidth: 256 },
    maximizable: false,
    minimizable: false,
    animation: false,
    signal,
    content: {
      tag: "ui-tabs",
      content: [
        tab(
          "New effect",
          Object.values(appsManager.value)
            .filter((app) => app.hasAudioInput && app.hasAudioOutput !== false)
            .map((app) => ({
              label: app.name,
              name: app.name,
              picto: appsManager.getAppIcon(app.name, "16x16"),
            })),
          true,
        ),
        tab("Open effects", opened, false),
      ],
    },
    on: {
      "ui:dialog.close": () => {
        if (!picking) resolve()
      },
    },
  })
  const cancel = () => resolve()
  if (signal.aborted) cancel()
  else signal.addEventListener("abort", cancel, { once: true })
  const lists = pickerEl.querySelectorAll("ui-listbox")
  mixer.effectTracks.on("change", { signal: pickerEl.signal }, () => {
    lists[1].content = opened()
  })
  try {
    return await result
  } finally {
    signal.removeEventListener("abort", cancel)
  }
}
