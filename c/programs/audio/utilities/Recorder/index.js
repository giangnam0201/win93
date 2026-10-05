// import "../../../../42/ui/media/basicPlayer.js"
import "../../../../../42/ui/media/player.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { render } from "../../../../../42/api/gui/render.js"
import { filePickerSave } from "../../../../../42/ui/desktop/explorer.js"
import { AudioRecorder } from "../../../../../42/lib/audio/AudioRecorder.js"
import { getSortableDateTime } from "../../../../../42/lib/date/getSortableDateTime.js"
import { WAV } from "../../../../../42/formats/codec/WAV.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  const gain = new GainNode(mixer.context)
  app.audioPipe = gain

  const audioContext = mixer.context
  let isRecording
  let listEl
  let recordBtn

  function addRecording(blob) {
    const timeStamp = getSortableDateTime({ seconds: true })

    const itemPlan = {
      tag: ".cols.shrink.gap-xs",
      content: [
        {
          tag: "ui-player",
          src: URL.createObjectURL(blob),
          audioContext,
          mixer: false,
          controls: ["play", /* "duration", */ "loop", "seek"],
          created(el) {
            el.amp.disconnect()
            el.amp.connect(app.track)
          },
        },
        {
          tag: "button",
          picto: "save",
          title: "Save recording",
          onclick: async () => {
            const { ok, selection } = await filePickerSave({
              suggestedName: `recording_${timeStamp}.wav`,
              excludeAcceptAllOption: true,
              accept: { "audio/wav": [".wav"] },
            })

            if (ok && selection?.[0]) {
              const { fs } = await import("../../../../../42/api/fs.js")
              const wav = await WAV.encode(blob, {
                audioContext,
                returnArrayBuffer: true,
              })
              await fs.write(selection[0], wav)
            }
          },
        },
        {
          tag: "button",
          picto: "trash",
          title: "Delete recording",
          action: (e, target) => {
            target.parentElement.remove()
          },
        },
      ],
    }

    render(itemPlan, listEl)
    listEl.scrollTop = listEl.scrollHeight
    app.dialogEl.resize()
  }

  const audioRecorder = new AudioRecorder(mixer.context)

  return [
    {
      tag: "button",
      picto: "mic",
      content: "Record",
      aria: { pressed: false },
      created(el) {
        recordBtn = el
      },
      onclick: () => {
        if (isRecording) {
          isRecording = false
          recordBtn.firstChild.value = "mic"
          recordBtn.lastChild.textContent = "Record"
          recordBtn.ariaPressed = false
          audioRecorder.stop()
        } else {
          isRecording = true
          recordBtn.firstChild.value = "stop"
          recordBtn.lastChild.textContent = "Stop"
          recordBtn.ariaPressed = true
          audioRecorder
            .record(gain, { mimeType: "audio/webm" })
            .then((blob) => addRecording(blob))
        }
      },
    },
    {
      tag: ".rows.ma-t-xxs.pa-xs.gap-xs.grow.scroll-y-auto.hide-empty.inset.panel",
      async created(el) {
        listEl = el

        // const loadBlob = await import(
        //   "../../../../42/api/load/loadBlob.js"
        // ).then(({ loadBlob }) => loadBlob)
        // const dummyBlob = await loadBlob(
        //   "/c/users/windows93/sounds/samples/amenbreak.ogg",
        // )
        // addRecording(dummyBlob)
        // addRecording(dummyBlob)
        // addRecording(dummyBlob)
        // addRecording(dummyBlob)

        // setTimeout(() => {
        //   const player = el.querySelector("ui-player")
        //   player.volume = 0.1
        //   player.loop = true
        //   player.play()
        // }, 100)
      },
    },
  ]
}
