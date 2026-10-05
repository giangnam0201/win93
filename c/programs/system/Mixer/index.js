import "../../../../42/ui/control/knob.js"
import "../../../../42/ui/control/volume.js"
import { mixer } from "../../../../42/lib/audio/mixer.js"
import { os } from "../../../../42/api/os.js"
import { css } from "../../../../42/lib/dom/appendCSS.js"
import { render } from "../../../../42/api/gui/render.js"
import { AudioApp } from "../../../../42/api/os/AudioApp.js"
import {
  isMidiControlActive,
  enableMidiControl,
  disableMidiControl,
  getMidiInputs,
  isDeviceSelected,
  setDeviceSelected,
} from "../../../../42/api/os/midiControl.js"

/** @import {AudioMixerTrack, AudioMixerMainTrack} from "../../../../42/lib/audio/mixer.js" */

css`
  #tracks:empty,
  #tracks:empty + hr,
  #effectTracks:empty,
  #effectTracks:empty + hr {
    display: none;
  }
`

/**
 * @param {AudioMixerTrack | AudioMixerMainTrack} track
 * @returns {track is AudioMixerMainTrack}
 */
function isMainTrack(track) {
  return track.isMainTrack
}

/**
 * @param {AudioMixerTrack | AudioMixerMainTrack} track
 * @param {{
 *   showCables: boolean,
 *   showMainCables: boolean,
 *   useStraightCables: boolean
 * }} state
 */
function makeTrackGui(track, state) {
  const { name, picto, app } = track

  let trackEl

  return {
    tag: ".track.rows.items-center",
    id: `track__${track.id}`,
    style: { flex: "none" },
    created(el) {
      trackEl = el
    },
    content: [
      {
        tag: ".track-source.ratio.w-full.center-content",
        content: [
          {
            tag: "button.clear",
            title: name,
            picto,
            on: {
              "pointerenter"(e, target) {
                target.title = track.name
              },
              "pointerdown || Space || Enter"(e) {
                if (e.ctrlKey || e.metaKey) {
                  if (app.selectAudioIO) {
                    app.selectAudioIO()
                  } else {
                    AudioApp.prototype.selectAudioIO.call(app)
                  }
                } else if (app?.dialogEl) {
                  if (app.dialogEl.minimized) app.dialogEl.unminimize()
                  app.dialogEl.activate()
                }
                return false
              },
              "contextmenu"() {
                track.resetParams()
                return false
              },
            },
          },
        ],
      },

      "---",

      {
        tag: "ui-knob",
        name: "Hi",
        small: true,
        centerDetent: true,
        min: -24,
        max: 24,
        unit: "dB",
        watchAutomations: true,
        bind: track.high.gain,
      },
      {
        tag: "ui-knob",
        name: "Mid",
        small: true,
        centerDetent: true,
        min: -24,
        max: 24,
        unit: "dB",
        watchAutomations: true,
        bind: track.mid.gain,
      },
      {
        tag: "ui-knob",
        name: "Low",
        small: true,
        centerDetent: true,
        min: -24,
        max: 24,
        unit: "dB",
        watchAutomations: true,
        bind: track.low.gain,
      },

      {
        tag: "ui-volume.ma-t-xs",
        max: 11,
        min: -Infinity,
        watchAutomations: true,
        audioInput: track.stereo,
        bind: track.postEffects.gain,
        // bind: track.amp.gain,
        // indicator: "both",
      },

      {
        tag: "ui-knob",
        name: "Pan",
        small: true,
        centerDetent: true,
        watchAutomations: true,
        bind: track.stereo.crossfader,
      },

      "---",

      {
        tag: ".track-destination.ratio.w-full.center-content",
        content: {
          tag: "div.track-destination__list.fit.wrap-list.pa-0",
          content: [
            {
              tag: "button.clear > ui-picto",
              value: isMainTrack(track) ? "audio-on" : "mixer",
            },
          ],
        },
        ...(isMainTrack(track)
          ? {
              on: {
                "pointerdown || Space || Enter"() {
                  console.log("TODO: select destination")
                },
              },
            }
          : {
              on: {
                "disrupt": true,
                "contextmenu"() {
                  if (track.app) return
                  console.log(track.app)
                },
                "pointerdown || Space || Enter"() {
                  const { value } = track.destinations.values().next()
                  value?.app?.dialogEl?.activate()
                },
              },
              created(el, { signal }) {
                function displayOutput() {
                  el.firstChild.replaceChildren()
                  for (const item of track.destinations) {
                    el.firstChild.append(
                      render({
                        tag: "button.clear > ui-picto",
                        value: item ? item.picto : "mixer",
                      }),
                    )
                  }
                }
                displayOutput()
                track.destinations.on("change", { signal }, displayOutput)
              },
            }),
      },

      {
        tag: ".rows.grow.gap-xs.w-full",
        content: [
          {
            tag: "button.track-mute.pa-false.pointer-instant",
            title: "Mute track",
            aria: { pressed: track.muted },
            content: "M",
            on: {
              "pointerdown || Space || Enter": () => track.toggleMute(),
            },
            created(el, { signal }) {
              track.on("mute", { signal }, (bool) => {
                el.ariaPressed = bool
                trackEl.classList.toggle("track--muted", bool)
              })
            },
          },

          isMainTrack(track)
            ? {
                tag: "button.mainTrack-configuration.pa-false.pointer-instant",
                title: "Configuration",
                picto: "cog",
                menu: () => [
                  {
                    tag: "checkbox",
                    label: "Show cables",
                    checked: () => state.showCables,
                    action(event, target) {
                      mixer.setShowCables(target.checked)
                    },
                  },
                  {
                    tag: "checkbox",
                    label: "Show cables to the main channel",
                    checked: () => state.showMainCables,
                    action(event, target) {
                      state.showMainCables = target.checked
                      mixer.emit("patchOptions")
                    },
                  },
                  {
                    tag: "checkbox",
                    label: "Use straight lines for the cables",
                    checked: () => state.useStraightCables,
                    action(event, target) {
                      state.useStraightCables = target.checked
                      mixer.emit("patchOptions")
                    },
                  },
                  "---",
                  {
                    label: "Enable MIDI Control",
                    tag: "checkbox",
                    checked: isMidiControlActive(),
                    action: async (e, target) => {
                      if (isMidiControlActive()) {
                        disableMidiControl()
                      } else {
                        try {
                          await enableMidiControl()
                        } catch (err) {
                          os.toast(`MIDI access failed: ${err.message}`)
                        }
                      }
                      target.checked = isMidiControlActive()
                    },
                  },
                  {
                    label: "MIDI Devices",
                    content: () => {
                      const inputs = getMidiInputs()
                      if (inputs.length === 0) {
                        return [{ label: "No MIDI Devices", disabled: true }]
                      }
                      return inputs.map((input) => ({
                        label: input.name,
                        tag: "checkbox",
                        checked: isDeviceSelected(input.id),
                        action: (e, target) => {
                          setDeviceSelected(input.id, target.checked)
                        },
                      }))
                    },
                  },
                  // {
                  //   label: "Restart mixer",
                  //   action: () => mixer.restartTrack(mixer.mainTrack),
                  // },
                  // {
                  //   label: "Restart all tracks",
                  //   action: () => {
                  //     for (const track of mixer.tracks.values()) {
                  //       mixer.restartTrack(track)
                  //     }
                  //     for (const track of mixer.effectTracks.values()) {
                  //       mixer.restartTrack(track)
                  //     }
                  //     mixer.restartTrack(mixer.mainTrack)
                  //   },
                  // },
                ],
              }
            : {
                tag: "button.track-solo.pa-false.pointer-instant",
                title: "Solo track",
                aria: { pressed: track.soloed },
                content: "S",
                disabled: !track.toggleSolo,
                on: {
                  "pointerdown || Space || Enter": () => track.toggleSolo?.(),
                },
                created(el, { signal }) {
                  track.on("solo", { signal }, (bool) => {
                    el.ariaPressed = bool
                  })
                },
              },

          isMainTrack(track)
            ? {
                tag: "button.mainTrack-crossfader.pa-false",
                style: { aspectRatio: 0 },
                title: "Crossfader",
                picto: "crossfader",
                onclick: () => os.apps.launch("crossfader"),
              }
            : {
                tag: ".cols",
                content: [
                  {
                    tag: "button.track-sendA.pa-false.pointer-instant",
                    title: "Send A",
                    aria: { pressed: track.xfadeChannel === "A" },
                    picto: "letter-a",
                    disabled: !track.toggleXFadeChannel,
                    on: {
                      "pointerdown || Space || Enter": () =>
                        track.toggleXFadeChannel?.("A"),
                    },
                  },
                  {
                    tag: "button.track-sendB.pa-false.pointer-instant",
                    title: "Send B",
                    aria: { pressed: track.xfadeChannel === "B" },
                    picto: "letter-b",
                    disabled: !track.toggleXFadeChannel,
                    on: {
                      "pointerdown || Space || Enter": () =>
                        track.toggleXFadeChannel?.("B"),
                    },
                  },
                ],
                created: (el) => {
                  const sendA = el.querySelector(".track-sendA")
                  const sendB = el.querySelector(".track-sendB")
                  track.on("xfadeChannelChange", (channel) => {
                    if (channel === "A") {
                      sendA.ariaPressed = "true"
                      sendB.ariaPressed = "false"
                    } else if (channel === "B") {
                      sendA.ariaPressed = "false"
                      sendB.ariaPressed = "true"
                    } else {
                      sendA.ariaPressed = "false"
                      sendB.ariaPressed = "false"
                    }
                  })
                },
              },
        ],
      },
    ],
  }
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const state = await mixer.patchOptionsReady

  return {
    tag: "#mixer.cols.pa-xxs",
    content: [
      { tag: "#tracks.cols.gap-xs" },
      { tag: "hr", aria: { orientation: "vertical" } },
      { tag: "#effectTracks.cols.gap-xs" },
      { tag: "hr", aria: { orientation: "vertical" } },
      { tag: "#mainTrack" },
    ],
    created(el) {
      const { signal } = app

      const tracksEl = el.querySelector("#tracks")
      const effectTracksEl = el.querySelector("#effectTracks")
      const mainTrackEl = el.querySelector("#mainTrack")

      const map = new WeakMap()

      function addTrackGui(track, containerEl) {
        if (track.showInMixer === false) return
        const trackEl = render(makeTrackGui(track, state), containerEl, {
          signal,
        })
        map.set(track, trackEl)
      }

      function displayTracks(tracks, containerEl) {
        for (const track of tracks.values()) {
          addTrackGui(track, containerEl)
        }

        tracks
          .on("add", { signal }, (track) => {
            addTrackGui(track, containerEl)
          })
          .on("delete", { signal }, (key) => {
            const track = tracks.get(key)
            if (map.has(track)) {
              map.get(track).remove()
              map.delete(track)
            }
          })
      }

      displayTracks(mixer.tracks, tracksEl)
      displayTracks(mixer.effectTracks, effectTracksEl)
      addTrackGui(mixer.mainTrack, mainTrackEl)

      // Handle track restart by replacing GUI
      mixer.on("trackRestart", { signal }, (oldTrack, newTrack) => {
        const oldEl = map.get(oldTrack)
        if (oldEl) {
          const newEl = render(makeTrackGui(newTrack, state), null, { signal })
          oldEl.replaceWith(newEl)
          map.delete(oldTrack)
          map.set(newTrack, newEl)
        }
      })
    },
  }
}

/** @param {import("/42/api/os/AppAgent.js").AppAgent} appAgent */
export function renderTray(appAgent) {
  return {
    tag: "button.clear",
    picto: "audio-on",
    on: {
      contextmenu: false,
      pointerdown(e) {
        if (e.button === 2) return void mixer.mainTrack.toggleMute()
        appAgent.toggle()
      },
    },
    created(el, { signal }) {
      mixer.mainTrack.on("mute", { signal }, (bool) => {
        el.firstChild.value = bool ? "audio-off" : "audio-on"
      })
    },
  }
}
