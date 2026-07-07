import { mixer } from "../../lib/audio/mixer.js"
import { sleep } from "../../lib/timing/sleep.js"
import { untilAnimationEnd } from "../../lib/type/element/untilAnimationEnd.js"
import { extractDialogOptions, dialog } from "../../ui/layout/dialog.js"

/** @import { MenuComponent } from "../../ui/layout/menu.js" */
/** @import { AudioMixerTrackBase }  from "../../lib/audio/mixer.js" */
/** @import { AudioApp }  from "./AudioApp.js" */

// MARK: audioInputToMenuItem
// --------------------------

// const maxWidth = "20ch"

/**
 * @param {AbortSignal} signal
 * @param {AudioMixerTrackBase} track
 * @param {any} selectTrack
 * @param {any} multiple
 * @param {boolean} [isCurrent]
 */
function audioInputToMenuItem(signal, track, selectTrack, multiple, isCurrent) {
  const { name, picto } = track
  return {
    tag: multiple ? "checkbox" : undefined,
    checked: multiple ? selectTrack.has(track) : undefined,
    disabled: isCurrent,
    label: {
      tag: ".cols.gap-xs.items-center",
      // style: { maxWidth },
      content: [
        {
          tag: "span.truncate",
          content: name,
        },
        {
          tag: "ui-volume.shrink",
          small: true,
          inert: true,
          audioInput: track.stereo,
        },
      ],
    },
    picto,
    action: (e, target) => {
      if (multiple) {
        selectTrack[target.checked ? "add" : "delete"](track)
      } else {
        selectTrack(track)
        target.closest("ui-dialog").close()
      }
    },
    created: multiple
      ? (el) => {
          selectTrack.on?.("change", { signal }, () => {
            el.checked = selectTrack.has(track)
          })
        }
      : undefined,
  }
}

// MARK: audioOutputToMenuItem
// ---------------------------

/**
 * @param {AbortSignal} signal
 * @param {AudioMixerTrackBase} track
 * @param {AudioMixerTrackBase} source
 * @param {boolean} isCurrent
 */
function audioOutputToMenuItem(signal, track, source, isCurrent) {
  const { name, picto } = track
  return {
    tag: "checkbox",
    checked: source.destinations.has(track),
    disabled: isCurrent,
    label: {
      tag: ".cols.gap-xs.items-center",
      // style: { maxWidth },
      content: [
        {
          tag: "span.truncate",
          content: name,
        },
        {
          tag: "ui-volume.shrink",
          small: true,
          inert: true,
          audioInput: track.stereo,
        },
      ],
    },
    picto,
    action: (e, target) => {
      if (track.isEffectTrack) {
        track.app.audioInputs[target.checked ? "add" : "delete"](source)
      } else {
        source[target.checked ? "connect" : "disconnect"](track)
      }
    },
    created(el) {
      source.destinations.on("change", { signal }, () => {
        el.checked = source.destinations.has(track)
      })
    },
  }
}

// MARK: makeInputsPlan
// --------------------

function makeInputsPlan(signal, currentTrack, selectTrack, multiple) {
  /** @type {any} */
  const plan = [
    // {
    //   tag: "checkbox",
    //   label: "Line In",
    //   picto: "mic",
    //   action: async () => {
    //     const { exec } = await import("./exec.js")
    //     const lineInApp = await exec("linein")
    //     if (multiple) {
    //       selectTrack.add(lineInApp.track)
    //     } else {
    //       selectTrack(lineInApp.track)
    //     }
    //   },
    // },
    // "---",
    // audioInputToMenuItem(
    //   signal,
    //   mixer.mainTrack,
    //   selectTrack,
    //   multiple,
    //   currentTrack === mixer.mainTrack,
    // ),
    // "---",
  ]

  for (const track of mixer.tracks.values()) {
    // let verb = "push"
    // if (track.app.command === "linein") {
    //   if (plan[0]?.picto === "mic") plan.shift()
    //   verb = "unshift"
    // }
    // plan[verb](
    plan.push(
      audioInputToMenuItem(
        signal, //
        track,
        selectTrack,
        multiple,
      ),
    )
  }

  plan.push("---")

  for (const track of mixer.effectTracks.values()) {
    plan.push(
      audioInputToMenuItem(
        signal,
        track,
        selectTrack,
        multiple,
        currentTrack === track,
      ),
    )
  }

  plan.push(
    "---",
    audioInputToMenuItem(
      signal,
      mixer.mainTrack,
      selectTrack,
      multiple,
      currentTrack === mixer.mainTrack,
    ),
  )

  return plan
}

// MARK: makeOutputsPlan
// --------------------

function makeOutputsPlan(signal, currentTrack) {
  const plan = [
    audioOutputToMenuItem(
      signal,
      mixer.mainTrack,
      currentTrack,
      currentTrack === mixer.mainTrack,
    ), //
    "---",
  ]

  for (const track of mixer.effectTracks.values()) {
    // if (options?.current && options?.current === track) continue
    plan.push(
      audioOutputToMenuItem(
        signal,
        track, //
        currentTrack,
        currentTrack === track,
      ),
    )
  }

  return plan
}

/* MARK: selectAudioIO
---------------------- */

/**
 * @param {any} options
 * @param {AudioApp} [audioApp]
 */

export async function selectAudioIO(options, audioApp) {
  let bucket
  let multiple

  const dialogOptions = extractDialogOptions(options)

  if (options?.bucket) {
    multiple = true
    bucket = options?.bucket
  }

  if (options?.multiple) {
    multiple = true
    bucket ??= new Set()
  }

  dialogOptions.label ??= "Audio I/O"
  dialogOptions.picto ??= "jack-socket"

  await Promise.race([
    untilAnimationEnd(audioApp.dialogEl), //
    sleep(400),
  ])

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    const selectTrack = multiple ? bucket : resolve

    const inputsContent = [
      {
        tag: "ui-menu.inputs-menu.inset.scroll-y-auto.w-full.grow",
        autofocus: true,
        content: ({ signal }) =>
          makeInputsPlan(signal, options.current, selectTrack, multiple),
      },
    ]

    const outputsContent = options?.current
      ? [
          {
            tag: "ui-menu.outputs-menu.inset.scroll-y-auto.w-full.grow",
            content: ({ signal }) => makeOutputsPlan(signal, options.current),
          },
        ]
      : undefined

    const dialogEl = await dialog({
      style: { minWidth: 256 },

      // resizable: false,
      maximizable: false,
      minimizable: false,
      animation: false,

      position: {
        my: "center",
        at: "center",
        dynamic: false,
        of: audioApp.dialogEl,
      },

      content: [
        options?.current
          ? {
              tag: "ui-tabs",
              content: [
                {
                  label: "Inputs",
                  picto: "arrow-input",
                  content: inputsContent,
                },
                {
                  // selected: true,
                  label: "Outputs",
                  picto: "arrow-output",
                  content: outputsContent,
                },
              ],
            }
          : inputsContent,
        multiple && {
          // tag: "footer.grid-2.gap-xxs.ma-t-xxs",
          tag: "footer.ma-t-xxs",
          content: [
            {
              tag: "button.w-full",
              content: "Ok",
              onclick: () => dialogEl.close(true),
            },
            // {
            //   tag: "button",
            //   content: "Cancel",
            //   onclick: () => dialogEl.close(false),
            // },
          ],
        },
      ],

      on: {
        "ui:dialog.close"({ detail }) {
          resolve(multiple ? bucket : detail.ok)
        },
      },

      ...dialogOptions,

      signal: options?.signal,
    })

    if (audioApp?.selecting) audioApp.selecting = dialogEl

    const { signal } = dialogEl
    const tabsEl = dialogEl.querySelector("ui-tabs")

    /** @type {MenuComponent[]} */
    const menus = [
      dialogEl.querySelector(".inputs-menu"),
      dialogEl.querySelector(".outputs-menu"),
    ]

    const updateList = async () => {
      await Promise.all(menus.map((el) => el.rerender()))
      dialogEl.resize()
    }

    mixer.tracks.on("change", { signal }, updateList)
    mixer.effectTracks.on("change", { signal }, updateList)

    if (tabsEl) {
      tabsEl.addEventListener("ui:tab-change", updateList, { signal })
    }
  })
}

export function selectAudioInputs(options, audioApp) {
  return selectAudioIO({ displayInputs: true, ...options }, audioApp)
}

export function selectAudioOutputs(options, audioApp) {
  return selectAudioIO({ displayOutputs: true, ...options }, audioApp)
}
