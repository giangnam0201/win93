import "../../../../42/ui/control/knob.js"
import "../../../../42/ui/control/volume.js"
import { mixer } from "../../../../42/lib/audio/mixer.js"
import { os } from "../../../../42/api/os.js"
import { css } from "../../../../42/lib/dom/appendCSS.js"
import { render } from "../../../../42/api/gui/render.js"
import { AudioApp } from "../../../../42/api/os/AudioApp.js"
// import { menu } from "../../../../42/ui/layout/menu.js"

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
 */
function makeTrackGui(track) {
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
                menu: [
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
        const trackEl = render(makeTrackGui(track), containerEl, { signal })
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
          const newEl = render(makeTrackGui(newTrack), null, { signal })
          oldEl.replaceWith(newEl)
          map.delete(oldTrack)
          map.set(newTrack, newEl)
        }
      })
    },
  }
}

export function renderTray(manifest) {
  return {
    tag: "button.clear",
    picto: "audio-on",
    on: {
      contextmenu: false,
      pointerdown(e) {
        if (e.button === 2) {
          mixer.mainTrack.toggleMute()
          return
        }

        for (const item of os.apps.launched.values()) {
          if (item.command === manifest.command) {
            if (item.dialogEl.active) item.destroy()
            else item.dialogEl.activate()
            return
          }
        }

        os.apps.launch(manifest.command)
      },
    },
    created(el, { signal }) {
      mixer.mainTrack.on("mute", { signal }, (bool) => {
        el.firstChild.value = bool ? "audio-off" : "audio-on"
      })
    },
  }
}
