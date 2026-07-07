import { render } from "../../../../../42/api/gui/render.js"
import { os } from "../../../../../42/api/os.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"
import { Timer } from "../../../../../42/lib/timing/Timer.js"
import { capitalize } from "../../../../../42/lib/type/string/capitalize.js"

const INSTRUMENT_ALIASES = {
  guitar: "acoustic_guitar_nylon",
  bass: "electric_bass_finger",
}

/** @type {any} */
const TUNINGS = {
  guitar: [
    ["Standard", "E2 A2 D3 G3 B3 E4"],
    ["Drop D", "D2 A2 D3 G3 B3 E4"],
    "---",
    ["Open A", "E2 A2 E3 A3 C#4 E4"],
    ["Open B", "B1 F#2 B2 F#3 B3 D#4"],
    ["Open C", "C2 G2 C3 G3 C4 E4"],
    ["Open D", "D2 A2 D3 F#3 A3 D4"],
    ["Open F", "F2 A2 C3 F3 C4 F4"],
    ["Open G", "D2 G2 D3 G3 B3 D4"],
    "---",
    ["Drop A", "A1 E2 A2 D3 F#3 B3"],
    ["Drop A#", "A#1 D2 A#2 D#3 G3 C4"],
    ["Drop B", "B1 F#2 B2 E3 G#3 C#4"],
    ["Drop C", "C2 G2 C3 F3 A3 D4"],
    ["Drop C#", "C#2 G#2 C#3 F#3 A#3 D#4"],
    ["Drop D", "D2 A2 D3 G3 B3 E4"],
    ["Drop D#", "D#1 A#1 D#2 G#2 C3 F3"],
    ["Drop E", "E1 B1 E2 A2 C#3 F#3"],
    ["Drop F", "F1 C2 F2 A#2 D3 G3"],
    ["Drop F#", "F#1 C#2 F#2 B2 D#3 G#3"],
    ["Drop G", "G1 E2 G2 C3 E3 A3"],
    ["Drop G#", "G#1 D#2 G#2 C#3 F3 A#3"],
    "---",
    ["Lute", "E2 A2 D3 F#3 B3 E4"],
    ["Irish", "D2 A2 D3 G3 A3 D4"],
    "---",
    ["Standard (7)", "B1 E2 A2 D3 G3 B3 E4"],
    ["Drop A (7)", "A1 E2 A2 D3 G3 B3 E4"],
  ],
  bass: [
    ["Standard", "E1 A1 D2 G2"],
    ["Drop D", "D1 A1 D2 G2"],
    "---",
    ["Standard (5)", "B0 E1 A1 D2 G2"],
    ["Drop A (5)", "A0 E1 A1 D2 G2"],
  ],
  violin: [
    ["Standard", "G3 D4 A4 E5"],
    "---",
    ["Cajun", "F3 C4 G4 D5"],
    ["Sawmill", "G3 D4 G4 D5"],
    "---",
    ["Open D", "D3 D4 A4 D5"],
    ["Open G", "G3 D4 G4 B4"],
  ],
  ukulele: [
    ["Standard", "G4 C4 E4 A4"],
    ["Bass", "E2 A2 D3 G3"],
    ["Bariton", "D3 G3 B3 E4"],
    ["Tenor", "G4 C4 E4 A4"],
    ["Soprano", "A4 D4 F#4 B4"],
  ],
  banjo: [
    ["Standard", "G4 D3 G3 B3 D4"],
    ["Double C", "G4 C3 G3 C4 D4"],
    ["Sawmill", "G4 D3 G3 C4 D4"],
    ["Open D", "F#4 D3 F#3 A3 D4"],
    ["Double D", "A4 D3 A3 D4 E4"],
    ["Open A", "A4 E3 A3 C#4 E4"],
  ],
  mandolin: [
    ["Standard", "G3 D4 A4 E5"],
    ["Gee-dad", "G3 D4 A4 D5"],
    ["Open G", "G3 D4 G4 B4"],
    ["Sawmill", "G3 D4 G4 D5"],
    ["High Bass", "A3 D4 A4 E5"],
  ],
  airhorn: [
    ["Standard", "D4"], //
  ],
}

// ─────────────────────────────────────────────
// tuningMap global (notes indexées)
// ─────────────────────────────────────────────
const tuningMap = []
for (const instr of Object.values(TUNINGS)) {
  for (const item of instr) {
    if (Array.isArray(item)) {
      item[1] = tuningMap.push(item[1].split(" ")) - 1
    }
  }
}

const instruments = Object.keys(TUNINGS).map((x) => [capitalize(x), x])

function playSample(destination, buffer) {
  const source = new AudioBufferSourceNode(destination.context, { buffer })
  source.connect(destination)
  source.start(0)
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const state = await app.initState({
    instrument: "guitar",
    tuning: 0,
    loop: false,
  })

  const audioContext = mixer.context
  const compressor = new DynamicsCompressorNode(audioContext, {
    threshold: -50,
    knee: 40,
    ratio: 12,
    attack: 0,
    release: 0.25,
  })

  mixer.addTrack(compressor, { app })

  let tuningEl
  let buttonsEl

  function setTuning(idx) {
    idx = Number(idx)
    state.tuning = idx

    tuningEl.value = idx

    const notes = tuningMap[idx]
    if (!notes) return

    buttonsEl.className = `split-${notes.length} gap-xs`
    buttonsEl.replaceChildren()

    render(
      notes.map((note) => ({
        tag: "button.note.pa-x-xxs",
        dataset: {
          instrument: INSTRUMENT_ALIASES[state.instrument] ?? state.instrument,
          note: note
            .replace("A#", "Bb")
            .replace("C#", "Db")
            .replace("D#", "Eb")
            .replace("F#", "Gb")
            .replace("G#", "Ab"),
        },
        content: {
          tag: "span",
          style: { minWidth: "3ch" },
          content: note.replaceAll(/\d/g, ""),
        },
      })),
      buttonsEl,
    )

    toggleNotes()
    app.resize({ animate: false })
  }

  function setInstrument(instrument, tuning) {
    state.instrument = instrument
    const tunings = TUNINGS[instrument]

    tuningEl.replaceChildren()
    render(tunings, tuningEl)

    setTuning(tuning === undefined ? tunings[0][1] : tuning)
  }

  const timer = new Timer(
    () => playNote(state.note), //
    { signal: app.signal },
  )

  async function playNote(note) {
    state.note = note

    const instrument = INSTRUMENT_ALIASES[state.instrument] ?? state.instrument

    const url =
      instrument === "airhorn"
        ? `/c/users/windows93/sounds/poney/air-horn.ogg`
        : `/c/users/windows93/sounds/soundfonts/${instrument}/${note}.ogg`

    let data
    try {
      data = await os.load.arrayBuffer(url)
    } catch {
      return
    }

    const buffer = await audioContext.decodeAudioData(data)
    playSample(compressor, buffer)
  }

  function toggleNotes(note) {
    for (const item of buttonsEl.children) {
      item.ariaPressed = item.dataset.note === note ? "true" : "false"
    }
  }

  return {
    tag: "main.rows.gap-xs",
    content: [
      {
        tag: "header.split-2.gap-xxs",
        content: [
          {
            tag: "select",
            label: "Instrument",
            content: instruments,
            value: state.instrument,
            box: { class: { "label-above": true, "label-left": true } },
            oninput: ({ target }) => setInstrument(target.value),
          },
          {
            tag: "select",
            label: "Tuning",
            value: state.tuning,
            box: { class: { "label-above": true, "label-left": true } },
            oninput: ({ target }) => setTuning(target.value),
            created: (el) => (tuningEl = el),
          },
        ],
      },
      {
        tag: "fieldset.cols.pa-sm.gap-sm",
        content: [
          {
            tag: ".split-7.gap-xs",
            created: (el) => (buttonsEl = el),
          },
          {
            tag: "button",
            title: "Loop note",
            picto: "loop",
            aria: { pressed: state.loop },
            on: {
              click: (e, target) => {
                state.loop = !state.loop
                target.ariaPressed = state.loop
                if (state.loop) {
                  playNote(state.note)
                  toggleNotes(state.note)
                  timer.start()
                } else {
                  toggleNotes()
                  timer.stop()
                }
              },
            },
          },
        ],
      },
    ],

    created() {
      setInstrument(state.instrument, state.tuning)
    },

    on: {
      "selector": "button.note",
      "pointerdown || Enter || Space": (e, target) => {
        playNote(target.dataset.note)
        if (state.loop) {
          toggleNotes(state.note)
          timer.start()
        }
      },
    },
  }
}
