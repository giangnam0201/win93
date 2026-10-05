import "../../../../../42/ui/layout/tabs.js"
import { render } from "../../../../../42/api/gui/render.js"
import { os } from "../../../../../42/api/os.js"
import { toggleSolo } from "./soloVoiceMask.js"
import { flattenOptions } from "./dialogShell.js"
import {
  DEFAULT_SOUNDFONT,
  SOUNDFONTS,
  groupedSoundfontOptions,
  resolveSoundfontValue,
} from "/c/libs/chip-player-js/soundfonts.js"

// Mirrors MIDI_ENGINE_* in players/MIDIPlayer.js.
const MIDI_ENGINE_LIBFLUIDLITE = 0
const MIDI_ENGINE_LIBADLMIDI = 1
export const MIDI_ENGINE_WEBMIDI = 2

// Mirrors LIVE_CONTROLLER_DEFAULTS' keys in players/MIDIPlayer/MIDIFilePlayer.js.
const LIVE_CONTROLLER_IDS = ["modwheel", "pitchbend"]

export { DEFAULT_SOUNDFONT, SOUNDFONTS, resolveSoundfontValue }

// 0 = SoundFont (libFluidLite), matches MIDIPlayer.js's own paramDef default.
export const DEFAULT_SYNTH_ENGINE = 0

// Matches the range input's neutral 1x playback speed.
const DEFAULT_TEMPO = 1

// Matches MIDIPlayer.js's own fluidpoly paramDef default.
const DEFAULT_POLYPHONY = 128

function buildChannelRows(voiceNames, voiceMask, currentMask, codec) {
  if (voiceNames.length === 0) {
    return { tag: ".label", content: "No channel info available." }
  }
  const checkboxEls = []
  return {
    tag: ".grid-2",
    content: voiceNames.map((name, i) => ({
      tag: "checkbox",
      name: `voice${i}`,
      label: name || `Channel ${i + 1}`,
      checked: currentMask[i],
      box: { tag: "span" },
      created: (el) => {
        checkboxEls[i] = el
      },
      on: {
        change: (e, target) => {
          currentMask[i] = target.checked
          codec.setVoiceMask(currentMask.slice())
        },
        contextmenu: (e) => {
          e.preventDefault()
          toggleSolo(currentMask, i)
          checkboxEls.forEach((el, j) => {
            if (el) el.checked = currentMask[j]
          })
          codec.setVoiceMask(currentMask.slice())
        },
      },
    })),
  }
}

// Bounds how long applyPersistedSynthEngine() will hold up playback waiting
// for the real device list -- permission prompt + device enumeration can
// take a few seconds, but a device that never turns up (no MIDI interface
// connected, or access denied) shouldn't block playback forever.
const MIDI_DEVICE_LIST_TIMEOUT_MS = 3000

// Resolves with the first "state" update carrying paramDefs (skipping any
// unrelated update, e.g. a voiceNames-only one) -- or null if none arrives
// within the timeout.
function waitForMidiDeviceList(codec) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      codec.off("state", handler)
      resolve(result)
    }
    const handler = (newState) => {
      if (newState.paramDefs) finish(newState)
    }
    codec.on("state", handler)
    setTimeout(() => finish(null), MIDI_DEVICE_LIST_TIMEOUT_MS)
  })
}

// Re-applies the persisted engine to a fresh codec -- a new codec always
// starts on FluidLite regardless of what's persisted, so without this the
// Settings dropdown would *show* the right engine while audio still played
// through the softsynth. Guarded by codec.appliedSynthEngine since
// setSynthEngine() panics (all-sound-off) every call, even when the value
// doesn't change -- without the guard, calling this on every track load
// while already in Web MIDI mode would re-panic and cut whatever's playing
// in Ableton. Awaits the full chain (not just the permission grant) so a
// caller can hold off starting playback until a real device is wired up --
// otherwise the track briefly renders through FluidLite before Web MIDI
// kicks in. Called from buildMidiSettings() below (unawaited, so the
// first-ever requestMIDIAccess() prompt still has a user gesture to fire
// from) and from MediaPlayer.js's beforePlay hook (awaited, to close that
// race on every subsequent track load).
export async function applyPersistedSynthEngine(codec, state) {
  const persisted = state.synthEngine ?? DEFAULT_SYNTH_ENGINE

  if (persisted === MIDI_ENGINE_WEBMIDI) {
    if (codec.appliedSynthEngine === MIDI_ENGINE_WEBMIDI) return
    try {
      // Start listening before ensureWebMidi() so the state update it
      // triggers (see setMidiDeviceNames() in MIDIPlayer.js) can't be missed.
      const deviceListReady = waitForMidiDeviceList(codec)
      await codec.ensureWebMidi()
      codec.setSynthEngine(MIDI_ENGINE_WEBMIDI)
      codec.appliedSynthEngine = MIDI_ENGINE_WEBMIDI
      const newState = await deviceListReady
      const def = newState?.paramDefs.find((p) => p.id === "mididevice")
      if (def) applyPersistedMidiDevice(codec, state, def)
    } catch (err) {
      os.toast(`Web MIDI access failed: ${err.message}`)
    }
    return
  }

  // A fresh codec always starts on FluidLite/bank 0 regardless of what's
  // persisted, same reasoning as Web MIDI above.
  if (persisted === MIDI_ENGINE_LIBADLMIDI) {
    if (codec.appliedSynthEngine !== persisted) {
      codec.setSynthEngine(persisted)
      codec.appliedSynthEngine = persisted
      if (state.opl3bank != null) codec.setOpl3Bank(state.opl3bank)
    }
  }
}

// Re-selects the persisted MIDI Device by name whenever the engine's device
// list (re-)arrives -- device index isn't stable across re-enumerations, so
// matching by name is the only way to find the right one back. Guarded by
// codec.lastAppliedMidiDeviceDef (not a dialog-local variable, so it stays
// correct whether or not Settings is open): setMidiDevice() does a real,
// audible resync cascade, and calling it on every routine state update
// instead of once per fresh device list caused a MIDI event flood that
// needed a device reboot. Returns the value to reflect in a <select>.
export function applyPersistedMidiDevice(codec, state, def) {
  if (!def) return 1
  const items = def.options[0].items
  const match = state.midiDeviceName
    ? items.find((item) => item.label === state.midiDeviceName)
    : undefined
  const value = match ? match.value : 1
  if (match && def !== codec.lastAppliedMidiDeviceDef) {
    codec.setMidiDevice(value)
  }
  codec.lastAppliedMidiDeviceDef = def
  return value
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {{ soundfont: string, synthEngine?: number }} state
 * @param {object} ephemeral Per-window, non-persisted store (see
 * MediaPlayer.js) for the fields that should reset to defaults each time the
 * app is opened, but stay put across tracks within that same window: Speed,
 * Transpose, Polyphony, Scale Key/Scale, Humanize, Random Note ("drunk"
 * internally), and the live MIDI controllers (Mod Wheel, Pitch Bend -- see
 * LIVE_CONTROLLER_IDS).
 * @returns {{label: string, content: object} | null}
 */
export function buildMidiSettings(playerEl, state, ephemeral) {
  const { codec } = playerEl
  if (!codec || codec.type !== "midi") return null

  applyPersistedSynthEngine(codec, state)

  state.soundfont = resolveSoundfontValue(state.soundfont)

  let voiceNames = codec.state?.voiceNames ?? []
  let voiceMask = codec.state?.voiceMask ?? []

  // Applied live as each field changes -- kept in sync locally so a single
  // checkbox toggle can still send the full mask setVoiceMask() expects.
  let currentMask = voiceNames.map((_, i) => voiceMask[i] !== false)

  const paramDefs = codec.state?.paramDefs ?? []
  const synthengineDef = paramDefs.find((p) => p.id === "synthengine")
  const opl3bankDef = paramDefs.find((p) => p.id === "opl3bank")
  const mididDeviceDef = paramDefs.find((p) => p.id === "mididevice")
  const fluidpolyDef = paramDefs.find((p) => p.id === "fluidpoly")
  const gmresetDef = paramDefs.find((p) => p.id === "gmreset")
  const humanizeDef = paramDefs.find((p) => p.id === "humanize")
  const scalenameDef = paramDefs.find((p) => p.id === "scalename")
  const scalerootDef = paramDefs.find((p) => p.id === "scaleroot")
  const drunkDef = paramDefs.find((p) => p.id === "drunk")
  const currentEngine = state.synthEngine ?? DEFAULT_SYNTH_ENGINE
  // Read from `ephemeral` (per-window, non-persisted -- see MediaPlayer.js),
  // not codec.state: setTempo()/setParameter() never trigger a
  // playerStateUpdate broadcast, so codec.state would just keep showing
  // whatever it was at the last actual state event (track load) -- reopening
  // Settings after changing one of these would always show the stale/default
  // value, never what you just picked.
  const currentTempo = ephemeral.tempo ?? DEFAULT_TEMPO
  const currentTranspose = ephemeral.transpose ?? 0
  const currentPolyphony =
    ephemeral.polyphony ?? fluidpolyDef?.defaultValue ?? DEFAULT_POLYPHONY
  const currentOpl3Bank = state.opl3bank ?? opl3bankDef?.defaultValue ?? 0
  const currentHumanize = ephemeral.humanize ?? 0
  const currentScaleName =
    ephemeral.scaleName ?? scalenameDef?.defaultValue ?? "Chromatic"
  const currentScaleRoot = ephemeral.scaleRoot ?? scalerootDef?.defaultValue ?? 9
  const currentDrunk = ephemeral.drunk ?? 0

  let channelsFieldsetEl
  let midiDeviceSelectEl
  let soundfontRowEl
  let opl3RowEl
  let midiDeviceRowEl
  let polyphonyRowEl
  let tempoInputEl
  let polyphonyInputEl
  let humanizeInputEl
  let drunkInputEl
  const liveControllerInputEls = {}

  return {
    label: "MIDI Settings",
    content: {
      tag: "ui-tabs.h-full",
      // Rebuild the Channels tab (and refresh the MIDI Device list, once Web
      // MIDI access resolves) whenever a new track loads -- codec is reused
      // across tracks, so its channel count/names/mask change out from under
      // an already-open dialog otherwise.
      created: (el) => {
        codec.on("state", { signal: el.signal }, (newState) => {
          if (newState.voiceNames) {
            voiceNames = newState.voiceNames
            voiceMask = newState.voiceMask ?? []
            currentMask = voiceNames.map((_, i) => voiceMask[i] !== false)
            if (channelsFieldsetEl) {
              const legend = channelsFieldsetEl.querySelector(":scope > legend")
              channelsFieldsetEl.replaceChildren(...(legend ? [legend] : []))
              render(
                buildChannelRows(voiceNames, voiceMask, currentMask, codec),
                channelsFieldsetEl,
              )
            }
          }
          if (newState.paramDefs && midiDeviceSelectEl) {
            const def = newState.paramDefs.find((p) => p.id === "mididevice")
            if (def) {
              midiDeviceSelectEl.replaceChildren()
              render(flattenOptions(def), midiDeviceSelectEl)
              // Rebuilding the options wipes whatever was selected --
              // reflect the persisted device (or the engine's own index-1
              // default if it's no longer present) back into the UI.
              const value = applyPersistedMidiDevice(codec, state, def)
              midiDeviceSelectEl.value = String(value)
            }
          }
        })
      },
      content: [
        {
          label: "General",
          content: {
            tag: "fieldset.aligned.grow",
            label: "Midi",
            content: [
              {
                tag: "select",
                name: "synthengine",
                label: "Synth Engine",
                value: String(currentEngine),
                content: flattenOptions(synthengineDef),
                on: {
                  change: (e, target) => {
                    const value = Number(target.value)
                    state.synthEngine = value
                    if (value === MIDI_ENGINE_WEBMIDI) {
                      // ensureWebMidi() must be called synchronously from
                      // this native "change" event (not after an await/
                      // postMessage hop) -- requestMIDIAccess() only prompts
                      // while user activation is still live. setSynthEngine()
                      // is deferred until it resolves: engaging WebMIDI
                      // immediately would let the song's events flow against
                      // the still-dummy output before a real device is wired
                      // up, and the whole song could finish before Ableton
                      // gets a single note.
                      codec
                        .ensureWebMidi()
                        .then(() => {
                          codec.setSynthEngine(value)
                          codec.appliedSynthEngine = value
                        })
                        .catch((err) => {
                          os.toast(`Web MIDI access failed: ${err.message}`)
                        })
                    } else {
                      codec.setSynthEngine(value)
                      codec.appliedSynthEngine = value
                    }
                    soundfontRowEl?.classList.toggle(
                      "hide",
                      value !== MIDI_ENGINE_LIBFLUIDLITE,
                    )
                    opl3RowEl?.classList.toggle(
                      "hide",
                      value !== MIDI_ENGINE_LIBADLMIDI,
                    )
                    midiDeviceRowEl?.classList.toggle(
                      "hide",
                      value !== MIDI_ENGINE_WEBMIDI,
                    )
                    polyphonyRowEl?.classList.toggle(
                      "hide",
                      value !== MIDI_ENGINE_LIBFLUIDLITE &&
                        value !== MIDI_ENGINE_WEBMIDI &&
                        value !== MIDI_ENGINE_LIBADLMIDI,
                    )
                  },
                },
              },
              {
                tag: "select",
                name: "soundfont",
                label: "Soundfont",
                value: state.soundfont,
                content: groupedSoundfontOptions(),
                // render()'s auto-selection only matches options placed
                // directly under the <select> -- it never sees inside the
                // <optgroup> wrappers this list uses, so the `value` prop
                // above is silently ignored and the browser just shows the
                // first option. Set it on the real DOM element instead,
                // once the <option>s actually exist: native select.value
                // assignment does look inside optgroups correctly.
                created: (el) => {
                  el.value = state.soundfont
                  soundfontRowEl = el.parentElement
                  soundfontRowEl.classList.toggle(
                    "hide",
                    currentEngine !== MIDI_ENGINE_LIBFLUIDLITE,
                  )
                },
                on: {
                  change: async (e, target) => {
                    state.soundfont = target.value
                    const url = target.value
                    // Fetch unducked first -- the current soundfont keeps
                    // playing normally no matter how long the download
                    // takes (instant if already fetched this session, see
                    // ChiptuneNode's soundfontCache). Only duck around
                    // applySoundfontBuffer(): unlike the fetch, that step is
                    // fast and bounded (the buffer's already in memory), so
                    // a short fixed duck safely covers it. Ducking is a
                    // plain output-gain fade (same setTargetAtTime pattern
                    // as mute/volume in player.js) -- it doesn't touch the
                    // sequencer, so the song keeps playing at the right
                    // position underneath regardless of how long any of
                    // this takes.
                    const { buffer, fellBack } =
                      await codec.loadSoundfontBuffer(url)
                    if (fellBack) {
                      os.toast(
                        `Soundfont "${target.value}" not found -- using gmgsx-plus.sf2 instead.`,
                        {
                          label: "MediaPlayer",
                          picto: os.apps.getAppIcon("MediaPlayer", "16x16"),
                        },
                      )
                    }
                    const { amp, audioContext } = playerEl
                    const now = audioContext.currentTime
                    amp.gain.cancelScheduledValues(now)
                    amp.gain.setTargetAtTime(0, now, 0.015)
                    setTimeout(() => {
                      codec.applySoundfontBuffer(url, buffer, fellBack)
                      const restoreAt = audioContext.currentTime
                      amp.gain.cancelScheduledValues(restoreAt)
                      amp.gain.setTargetAtTime(
                        playerEl.muted ? 0 : playerEl.volume,
                        restoreAt,
                        0.015,
                      )
                    }, 30)
                  },
                },
              },
              {
                // No wrapper row: a plain labeled <select> here becomes
                // <div class="control-box ..."><label/><select/></div>,
                // which is exactly the shape .aligned's grid expects (same
                // as Synth Engine/Soundfont above) -- wrapping it in an
                // extra .rows div (as before) squeezed the whole label+
                // select pair into just the narrow label column instead.
                // Show/hide targets that control-box directly, captured via
                // el.parentElement since it's already attached by the time
                // created() fires.
                tag: "select",
                name: "opl3bank",
                label: "OPL3 Bank",
                content: flattenOptions(opl3bankDef),
                created: (el) => {
                  opl3RowEl = el.parentElement
                  opl3RowEl.classList.toggle(
                    "hide",
                    currentEngine !== MIDI_ENGINE_LIBADLMIDI,
                  )
                  el.value = String(currentOpl3Bank)
                },
                on: {
                  change: (e, target) => {
                    const value = Number(target.value)
                    // Persisted so it survives a fresh player instance --
                    // see applyPersistedSynthEngine().
                    state.opl3bank = value
                    codec.setOpl3Bank(value)
                  },
                },
              },
              {
                tag: "select",
                name: "mididevice",
                label: "MIDI Device",
                content: flattenOptions(mididDeviceDef),
                created: (el) => {
                  midiDeviceSelectEl = el
                  midiDeviceRowEl = el.parentElement
                  midiDeviceRowEl.classList.toggle(
                    "hide",
                    currentEngine !== MIDI_ENGINE_WEBMIDI,
                  )
                  // The device list can already be fully resolved by the
                  // time this dialog opens (applyPersistedSynthEngine() now
                  // runs -- and waits for it -- before playback even
                  // starts), so the "state" listener below may never fire
                  // again to correct this select's value: resync it here
                  // too, from whatever's already known, same as on a later
                  // update.
                  el.value = String(
                    applyPersistedMidiDevice(codec, state, mididDeviceDef),
                  )
                },
                on: {
                  change: (e, target) => {
                    codec.setMidiDevice(Number(target.value))
                    // Persisted so it survives a fresh player instance --
                    // see the "state" handler above for why that matters.
                    state.midiDeviceName =
                      target.options[target.selectedIndex]?.text
                  },
                },
              },
              {
                tag: "div",
                created: (el) => {
                  polyphonyRowEl = el
                  polyphonyRowEl.classList.toggle(
                    "hide",
                    currentEngine !== MIDI_ENGINE_LIBFLUIDLITE &&
                      currentEngine !== MIDI_ENGINE_WEBMIDI &&
                      currentEngine !== MIDI_ENGINE_LIBADLMIDI,
                  )
                },
                content: [
                  {
                    tag: "label",
                    for: "mediaplayer-polyphony",
                    content: "Polyphony",
                  },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "mediaplayer-polyphony",
                        type: "range",
                        name: "polyphony",
                        label: false,
                        min: 1,
                        max: 256,
                        step: 1,
                        value: currentPolyphony,
                        created: (el) => {
                          polyphonyInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseInt(target.value, 10)
                            ephemeral.polyphony = value
                            codec.setPolyphony(value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset polyphony" },
                        action: () => {
                          polyphonyInputEl.value = String(DEFAULT_POLYPHONY)
                          ephemeral.polyphony = DEFAULT_POLYPHONY
                          codec.setPolyphony(DEFAULT_POLYPHONY)
                        },
                      },
                    ],
                  },
                ],
              },
              {
                // Built by hand (rather than the usual labeled-control
                // shorthand) so the Speed row fits .aligned's grid too: a
                // direct-child <div> whose first child is the <label> and
                // whose last child (the slider+reset row) fills the value
                // column -- same shape render() auto-generates for a plain
                // labeled field, just with an extra button alongside the
                // input in the value cell.
                tag: "div",
                content: [
                  { tag: "label", for: "mediaplayer-tempo", content: "Speed" },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "mediaplayer-tempo",
                        type: "range",
                        name: "tempo",
                        label: false,
                        min: 0.25,
                        max: 2,
                        step: 0.05,
                        value: currentTempo,
                        created: (el) => {
                          tempoInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseFloat(target.value)
                            ephemeral.tempo = value
                            codec.setTempo(value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset speed" },
                        action: () => {
                          tempoInputEl.value = String(DEFAULT_TEMPO)
                          ephemeral.tempo = DEFAULT_TEMPO
                          codec.setTempo(DEFAULT_TEMPO)
                        },
                      },
                    ],
                  },
                ],
              },
              {
                tag: "div",
                content: [
                  { tag: "label", content: "GM Reset" },
                  {
                    tag: "button._clear",
                    content: "Send Reset",
                    title: gmresetDef?.hint,
                    action: () => codec.resetGm(),
                  },
                ],
              },
            ],
          },
        },
        {
          label: "Channels",
          content: {
            tag: "fieldset.grow",
            label: "Channels",
            created: (el) => {
              channelsFieldsetEl = el
            },
            content: buildChannelRows(
              voiceNames,
              voiceMask,
              currentMask,
              codec,
            ),
          },
        },
        {
          label: "Extras",
          content: {
            tag: "fieldset.aligned.grow",
            label: "Extras",
            content: [
              {
                tag: "input",
                type: "number",
                name: "transpose",
                label: "Transpose",
                min: -24,
                max: 24,
                step: 1,
                value: currentTranspose,
                on: {
                  change: (e, target) => {
                    const clamped = Math.max(
                      -24,
                      Math.min(24, Number(target.value) || 0),
                    )
                    target.value = String(clamped)
                    ephemeral.transpose = clamped
                    codec.setTranspose(clamped)
                  },
                },
              },
              {
                tag: "div",
                content: [
                  {
                    tag: "label",
                    for: "mediaplayer-drunk",
                    content: "Random Note",
                  },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "mediaplayer-drunk",
                        type: "range",
                        name: "drunk",
                        label: false,
                        min: 0,
                        max: 100,
                        step: 1,
                        value: currentDrunk,
                        title: drunkDef?.hint,
                        created: (el) => {
                          drunkInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseFloat(target.value)
                            ephemeral.drunk = value
                            codec.setDrunk(value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset random note" },
                        action: () => {
                          drunkInputEl.value = "0"
                          ephemeral.drunk = 0
                          codec.setDrunk(0)
                        },
                      },
                    ],
                  },
                ],
              },
              {
                tag: "div",
                content: [
                  {
                    tag: "label",
                    for: "mediaplayer-humanize",
                    content: "Humanize",
                  },
                  {
                    tag: ".cols.items-center.gap-xs",
                    content: [
                      {
                        tag: "input.grow",
                        id: "mediaplayer-humanize",
                        type: "range",
                        name: "humanize",
                        label: false,
                        min: 0,
                        max: 1,
                        step: 0.01,
                        value: currentHumanize,
                        title: humanizeDef?.hint,
                        created: (el) => {
                          humanizeInputEl = el
                        },
                        on: {
                          input: (e, target) => {
                            const value = Number.parseFloat(target.value)
                            ephemeral.humanize = value
                            codec.setHumanize(value)
                          },
                        },
                      },
                      {
                        tag: "button._clear",
                        picto: "arrow-ccw",
                        aria: { label: "Reset humanize" },
                        action: () => {
                          humanizeInputEl.value = "0"
                          ephemeral.humanize = 0
                          codec.setHumanize(0)
                        },
                      },
                    ],
                  },
                ],
              },
              // Mod Wheel, Volume, Pan, Expression, Reverb/Chorus Send,
              // Aftertouch, Pitch Bend -- live-testable MIDI controllers,
              // for testing which ones actually do something audible on a
              // given soundfont/synth/device (unlike Transpose/Drunk/etc.
              // above, these are real MIDI messages, sent via the generic
              // setPlayerParameter() passthrough rather than a dedicated
              // codec.setXyz() each). Generated rather than hand-unrolled
              // like the fields above it, purely because there are 8 of
              // them and they're otherwise identical in shape.
              ...LIVE_CONTROLLER_IDS.map((id) => {
                const def = paramDefs.find((p) => p.id === id)
                const current = ephemeral[id] ?? def?.defaultValue ?? 0
                return {
                  tag: "div",
                  content: [
                    {
                      tag: "label",
                      for: `mediaplayer-${id}`,
                      content: def?.label ?? id,
                    },
                    {
                      tag: ".cols.items-center.gap-xs",
                      content: [
                        {
                          tag: "input.grow",
                          id: `mediaplayer-${id}`,
                          type: "range",
                          name: id,
                          label: false,
                          min: 0,
                          max: def?.max ?? 127,
                          step: 1,
                          value: current,
                          title: def?.hint,
                          created: (el) => {
                            liveControllerInputEls[id] = el
                          },
                          on: {
                            input: (e, target) => {
                              const value = Number.parseInt(target.value, 10)
                              ephemeral[id] = value
                              codec.setPlayerParameter(id, value)
                            },
                          },
                        },
                        {
                          tag: "button._clear",
                          picto: "arrow-ccw",
                          aria: { label: `Reset ${def?.label ?? id}` },
                          action: () => {
                            const resetValue = def?.defaultValue ?? 0
                            liveControllerInputEls[id].value = String(resetValue)
                            ephemeral[id] = resetValue
                            codec.setPlayerParameter(id, resetValue)
                          },
                        },
                      ],
                    },
                  ],
                }
              }),
              {
                tag: "select",
                name: "scalename",
                label: "Scale",
                value: currentScaleName,
                content: flattenOptions(scalenameDef),
                on: {
                  change: (e, target) => {
                    ephemeral.scaleName = target.value
                    codec.setScaleName(target.value)
                  },
                },
              },
              {
                tag: "select",
                name: "scaleroot",
                label: "Scale Key",
                value: String(currentScaleRoot),
                content: flattenOptions(scalerootDef),
                on: {
                  change: (e, target) => {
                    const value = Number(target.value)
                    ephemeral.scaleRoot = value
                    codec.setScaleRoot(value)
                  },
                },
              },
            ],
          },
        },
      ],
    },
  }
}
