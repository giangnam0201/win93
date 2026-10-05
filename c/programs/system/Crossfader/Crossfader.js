import { mixer } from "../../../../42/lib/audio/mixer.js"

const broadcast = new BroadcastChannel("crossfader")

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  return {
    tag: "#crossfader.cols.pa-xs.gap",
    content: [
      { tag: ".control", picto: "letter-a" }, //
      {
        tag: "range",
        min: 0,
        max: 1,
        step: 0.01,
        value: mixer.crossfaderValue,
        // list: [0.5],
        style: { "--ticks": "1 / 2" },
        on: {
          input: (e, { valueAsNumber }) => {
            broadcast.postMessage(valueAsNumber)
          },
        },
        created(crossfader) {
          const { signal } = app
          broadcast.addEventListener(
            "message",
            ({ data }) => {
              crossfader.valueAsNumber = data
            },
            { signal },
          )
        },
      },
      { tag: ".control", picto: "letter-b" },
    ],
  }
}
