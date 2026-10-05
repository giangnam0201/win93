import { toast } from "/42/ui/layout/toast.js"
import { enableMidiControl } from "/42/api/os/midiControl.js"
import { mixer } from "/42/lib/audio/mixer.js"
import {
  GM_INSTRUMENTS,
  GM_DRUM_KITS,
} from "/c/libs/chip-player-js/players/MIDIPlayer/MIDIConstants.js"
import { createRouter, createDefaultConfig, ENGINES } from "./router.js"
import "/42/ui/media/piano.js"
import {
  groupedSoundfontOptions,
  resolveSoundfontValue,
} from "/c/libs/chip-player-js/soundfonts.js"

const DRUM_CHANNEL = 9

const PIANO_WHITE_KEY_WIDTH = 19

const PROGRAM_OPTIONS = GM_INSTRUMENTS.map((name, i) => [
  name.trim(),
  String(i),
])

const DRUM_KIT_OPTIONS = Object.entries(GM_DRUM_KITS).map(([value, name]) => [
  name.trim(),
  value,
])

const MIDI_CHANNEL_OPTIONS = Array.from({ length: 16 }, (_, i) => [
  `${String(i + 1).padStart(2, "0")} - ${i === DRUM_CHANNEL ? "Drum Kit" : "Instrument"}`,
  String(i),
])

export async function renderApp(app) {
  const { signal } = app

  const audioContext = mixer.context
  audioContext.resume()
  const destination = audioContext.createGain()
  mixer.addTrack(destination, { app, signal })

  const config = await app.initState(createDefaultConfig())
  config.soundfont = resolveSoundfontValue(config.soundfont)
  const router = createRouter(audioContext, destination, config)

  await router.updateConfig({})

  let access
  try {
    access = await enableMidiControl()
  } catch (err) {
    toast(`MIDI access failed: ${err.message}`, {
      picto: "error",
      label: "MidiXpander",
      icon: app.getIcon(),
    })
  }

  const inputs = access ? [...access.inputs.values()] : []
  const outputs = access ? [...access.outputs.values()] : []
  router.setMidiOutputs(outputs)

  let selectedInput = null
  const handleMidiMessage = (event) => router.handleMessage(event)

  function attachInput(input) {
    selectedInput?.removeEventListener("midimessage", handleMidiMessage)
    selectedInput = input ?? null
    selectedInput?.addEventListener("midimessage", handleMidiMessage)
    config.midiInputId = input?.id ?? null
  }

  function detachInput() {
    selectedInput?.removeEventListener("midimessage", handleMidiMessage)
    selectedInput = null
  }

  const savedInput = inputs.find((input) => input.id === config.midiInputId)
  if (savedInput) attachInput(savedInput)

  signal.addEventListener("abort", () => {
    detachInput()
    router.destroy()
  })

  let indicatorEl
  let soundfontRowEl
  let opl3BankRowEl
  let midiDeviceRowEl
  let programRowEl
  let programSelectEl

  const opl3BankOptions = router.getOpl3Banks()

  function paintIndicator(isSounding) {
    if (!indicatorEl) return
    const ctx = indicatorEl.getContext("2d")
    ctx.fillStyle = isSounding ? "#3f3" : "#333"
    ctx.fillRect(0, 0, indicatorEl.width, indicatorEl.height)
  }

  router.setOnNoteStateChange(paintIndicator)
  router.setOnProgramChange((program) => {
    if (programSelectEl) programSelectEl.value = String(program)
  })

  let pianoEl

  function highlightPianoKey(note, isOn) {
    pianoEl?.setActive(note, isOn)
  }
  router.setOnNoteToggle(highlightPianoKey)

  function updateProgramOptions() {
    if (!programSelectEl || !programRowEl) return
    const isDrums = router.config.midiChannel === DRUM_CHANNEL
    const labelEl = programRowEl.querySelector("label")
    if (labelEl) labelEl.textContent = isDrums ? "Drum Kit" : "Instrument"
    programSelectEl.replaceChildren(
      ...(isDrums ? DRUM_KIT_OPTIONS : PROGRAM_OPTIONS).map(
        ([label, value]) => {
          const option = document.createElement("option")
          option.value = value
          option.textContent = label
          return option
        },
      ),
    )
    programSelectEl.value = String(router.config.program)
  }
  router.setOnSoundfontFallback((requested) => {
    toast(
      `Soundfont "${requested}" not found -- using gmgsx-plus.sf2 instead.`,
      {
        picto: "error",
        label: "MidiXpander",
        icon: app.getIcon(),
      },
    )
  })

  return {
    tag: "#mxp.pa-sm.h-full",
    content: [
      {
        tag: "fieldset.aligned.grow",
        role: "none",
        // label: "Track",
        content: [
          {
            tag: "select",
            name: "midiIn",
            label: "MIDI Input",
            value: config.midiInputId ?? "",
            content: [
              ["— No Input —", ""],
              ...inputs.map((input) => [input.name, input.id]),
            ],
            on: {
              change: (e, target) => {
                const input = inputs.find((item) => item.id === target.value)
                attachInput(input)
              },
            },
          },
          {
            tag: "div",
            content: [
              {
                tag: "label",
                for: "mxp-midiChannel",
                content: [
                  { tag: "span", content: "Channel" },
                  {
                    tag: "canvas.inset",
                    width: 10,
                    height: 10,
                    style: {
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      marginLeft: "6px",
                      verticalAlign: "middle",
                      imageRendering: "pixelated",
                    },
                    created: (el) => {
                      indicatorEl = el
                      paintIndicator(false)
                    },
                  },
                ],
              },
              {
                tag: "select",
                id: "mxp-midiChannel",
                name: "midiChannel",
                label: false,
                value: String(router.config.midiChannel),
                content: MIDI_CHANNEL_OPTIONS,
                on: {
                  change: (e, target) => {
                    router.updateConfig({ midiChannel: Number(target.value) })
                    if (pianoEl) pianoEl.channel = Number(target.value)
                    updateProgramOptions()
                  },
                },
              },
            ],
          },
          {
            tag: "select",
            name: "engine",
            label: "Engine",
            value: router.config.engine,
            content: [
              ["FluidSynth", ENGINES.FLUIDSYNTH],
              ["OPL3", ENGINES.OPL3],
              ["Midi Device", ENGINES.MIDI_DEVICE],
            ],
            on: {
              change: (e, target) => {
                router.updateConfig({ engine: target.value })
                const isFluidsynth = target.value === ENGINES.FLUIDSYNTH
                const isOpl3 = target.value === ENGINES.OPL3
                soundfontRowEl.classList.toggle("hide", !isFluidsynth)
                opl3BankRowEl.classList.toggle("hide", !isOpl3)
                programRowEl.classList.toggle("hide", !(isFluidsynth || isOpl3))
                midiDeviceRowEl.classList.toggle(
                  "hide",
                  target.value !== ENGINES.MIDI_DEVICE,
                )
              },
            },
          },
          {
            tag: "select",
            name: "soundfont",
            label: "Soundfont",
            content: groupedSoundfontOptions(),
            created: (el) => {
              el.value = router.config.soundfont
              soundfontRowEl = el.parentElement
              soundfontRowEl.classList.toggle(
                "hide",
                router.config.engine !== ENGINES.FLUIDSYNTH,
              )
            },
            on: {
              change: (e, target) => {
                router.updateConfig({ soundfont: target.value })
              },
            },
          },
          {
            tag: "select",
            name: "opl3bank",
            label: "OPL3 Bank",
            value: String(router.config.opl3Bank),
            content: opl3BankOptions,
            created: (el) => {
              opl3BankRowEl = el.parentElement
              opl3BankRowEl.classList.toggle(
                "hide",
                router.config.engine !== ENGINES.OPL3,
              )
            },
            on: {
              change: (e, target) => {
                router.updateConfig({ opl3Bank: Number(target.value) })
              },
            },
          },
          {
            tag: "select",
            name: "mididevice",
            label: "Midi Device",
            value: router.config.midiOutputId ?? "",
            content: [
              ["— No MIDI Device —", ""],
              ...outputs.map((output) => [output.name, output.id]),
            ],
            created: (el) => {
              midiDeviceRowEl = el.parentElement
              midiDeviceRowEl.classList.toggle(
                "hide",
                router.config.engine !== ENGINES.MIDI_DEVICE,
              )
            },
            on: {
              change: (e, target) => {
                router.updateConfig({ midiOutputId: target.value || null })
              },
            },
          },
          {
            tag: "select",
            name: "program",
            label:
              router.config.midiChannel === DRUM_CHANNEL
                ? "Drum Kit"
                : "Instrument",
            value: String(router.config.program),
            content:
              router.config.midiChannel === DRUM_CHANNEL
                ? DRUM_KIT_OPTIONS
                : PROGRAM_OPTIONS,
            created: (el) => {
              programSelectEl = el
              programRowEl = el.parentElement
              programRowEl.classList.toggle(
                "hide",
                router.config.engine === ENGINES.MIDI_DEVICE,
              )
            },
            on: {
              change: (e, target) => {
                router.updateConfig({ program: Number(target.value) })
              },
            },
          },
        ],
      },
      {
        tag: "ui-piano.mxp-piano.inset",
        from: 0,
        to: 127,
        style: {
          "height": "80px",
          "marginTop": "8px",
          "background": "var(--ButtonShadow)",
          "--piano-key-min-width": `${PIANO_WHITE_KEY_WIDTH}px`,
        },
        created: (el) => {
          pianoEl = el
          el.channel = router.config.midiChannel
          el.keyboardOctave = 2
          el.holdKey = false
          el.droneless = true
          el.addEventListener("midimessage", (event) => {
            router.handleMessage(event.detail)
          })
        },
      },
    ],
  }
}
