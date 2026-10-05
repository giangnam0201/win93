import "../../../../42/ui/layout/menu.js"
import "../../../../42/ui/media/player.js"
import "../../../../42/ui/media/scope.js"
import "../../../../42/ui/media/picto.js"
import { form } from "../../../../42/ui/layout/dialog.js"
import { os } from "../../../../42/api/os.js"
import { fileIndex } from "../../../../42/api/fileIndex.js"
import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"
import { audioMetadata } from "../../../../42/formats/metadata/audioMetadata.js"
import { TRANSPARENT } from "../../../../42/lib/constant/TRANSPARENT.js"
import { noop } from "../../../../42/lib/type/function/noop.js"
import {
  buildMidiSettings,
  applyPersistedSynthEngine,
  applyPersistedMidiDevice,
  DEFAULT_SOUNDFONT,
  resolveSoundfontValue,
} from "./settings/midi.js"
import { buildVgmSettings } from "./settings/vgm.js"
import { buildModSettings } from "./settings/mod.js"
import { buildGmeSettings } from "./settings/gme.js"
import { buildMdxSettings } from "./settings/mdx.js"
import { buildXmpFullSettings } from "./settings/xmpFull.js"
import { buildSidSettings } from "./settings/sid.js"
import { buildAdPlugSettings } from "./settings/adplug.js"
import { buildSc68Settings } from "./settings/sc68.js"
import { buildZxTuneSettings } from "./settings/zxtune.js"
import {
  buildAudioVideoSettings,
  setPreservesPitch,
  resetLoop,
  ensureLoopSeekListener,
  ensureLoopStopHook,
} from "./settings/audioVideo.js"
import {
  settingsDialogOptions,
  replaceDialogContent,
} from "./settings/dialogShell.js"

/** @import { PlayerComponent } from "../../../../42/ui/media/player.js" */

// Each codec type gets its own hand-built Settings content builder
// (deliberately not a generic paramDefs-driven renderer, so the polish
// already put into MIDI's dialog isn't lost) -- add an entry here as more
// get built. "xmp" covers mod/xm/s3m/it (libxmp-lite, chip-player-js);
// "xmpFull" covers the other ~35 tracker formats (standalone xmp codec, raw
// libxmp calls -- see findCodec.js's xmpFull entry and xmp.js's
// XMPBackendAdapter). "gme" covers nsf/nsfe/spc/ay/gbs. "mdx" covers Sharp
// X68000 .mdx only (".m" stays on the settings-less standalone codec, see
// findCodec.js's mFile entry).
const CONTENT_BUILDERS = {
  midi: buildMidiSettings,
  vgm: buildVgmSettings,
  xmp: buildModSettings,
  xmpFull: buildXmpFullSettings,
  gme: buildGmeSettings,
  mdx: buildMdxSettings,
  sidplayfp: buildSidSettings,
  // These three only get an "Info" tab (title/author/etc): checked directly
  // against their compiled WASM and none of them export channel mute or
  // tempo control at all, unlike sidplayfp (emu_enable_voice) or xmpFull
  // (bundles the full libxmp API on top of the generic glue).
  adplug: buildAdPlugSettings,
  sc68n: buildSc68Settings,
  zxtune: buildZxTuneSettings,
  // Plain <video>/<audio> playback (no findCodec match) -- codec.type is
  // set from playerEl.videoHeight in basicPlayer.js's loaded(), since a
  // raw HTMLMediaElement has no such property of its own.
  audio: buildAudioVideoSettings,
  video: buildAudioVideoSettings,
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const state = await app.initState({
    chain: "play-all",
    soundfont: DEFAULT_SOUNDFONT,
  })

  // Not persisted like `state` -- a fresh object per MediaPlayer window, so
  // fields kept here (see midi.js's use of it) reset to defaults each time
  // the app is opened, but stay put across tracks within that same window
  // (next/prev, or dropping a new file onto it).
  const ephemeral = {}

  /** @type {PlayerComponent} */
  let playerEl

  let trackTitleEl
  let trackCoverEl
  let sizedVideo
  let chainEl

  /** @type {HTMLButtonElement} */
  let prevBtn
  /** @type {HTMLButtonElement} */
  let nextBtn

  // Guards against spamming the Settings button open a stack of duplicate
  // dialogs -- one per renderApp() call, so it's scoped to this MediaPlayer
  // window specifically, not shared across every open MediaPlayer.
  // settingsPromise is the pending form() call (truthy while a dialog is
  // open); settingsDialogEl is the actual <ui-dialog>; settingsCodec is
  // which codec it belongs to, so a track that changes file type while
  // Settings is open can be detected (same-type track changes reuse the
  // same codec instance, so this only trips on a genuine type change, see
  // the "decode" handler).
  let settingsPromise = null
  let settingsDialogEl = null
  let settingsCodec = null

  // Opens the Settings dialog for `codec`'s type, or -- if one's already
  // open -- updates its content in place to match the new type instead of
  // closing and reopening a fresh window (same <ui-dialog>, no destroy/
  // recreate, no risk of two Settings dialogs ever existing at once).
  async function openSettingsForCodec(codec, { silent = false } = {}) {
    const buildContent = CONTENT_BUILDERS[codec?.type]
    const result = buildContent?.(playerEl, state, ephemeral)

    if (!result) {
      if (settingsDialogEl) settingsDialogEl.close(false)
      else if (!silent) os.toast("No settings available for this file type")
      return
    }

    if (settingsDialogEl) {
      replaceDialogContent(settingsDialogEl, result.content, {
        label: result.label,
      })
      settingsCodec = codec
      return
    }

    settingsCodec = codec
    settingsPromise = form(
      result.content,
      settingsDialogOptions({
        label: result.label,
        // The fieldset form() wraps content in isn't attached under its
        // <ui-dialog> yet at the moment this fires -- same reason tabs.js
        // waits a double rAF before measuring/dispatching -- so closest()
        // would come back empty read synchronously; give the tree a couple
        // of frames to finish attaching first.
        created: (fieldsetEl) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              settingsDialogEl = fieldsetEl.closest("ui-dialog")
            })
          })
        },
      }),
    )
    try {
      await settingsPromise
    } finally {
      settingsPromise = null
      settingsDialogEl = null
      settingsCodec = null
    }
  }

  function setTrackTitle(title) {
    trackTitleEl.textContent = title
    trackTitleEl.title = title
  }

  async function setMetadata(fileAgent) {
    if (playerEl.codec === playerEl.mediaEl) {
      const blob = await fileAgent.getBlob()
      const metadata = await audioMetadata(blob).catch(noop)
      if (metadata?.title) {
        const artist = metadata.albumartist ?? metadata.artist
        setTrackTitle(artist ? `${artist} - ${metadata.title}` : metadata.title)
      }
      if (metadata?.picture) {
        trackCoverEl.src = URL.createObjectURL(await metadata.getCoverBlob())
        trackCoverEl.parentElement.classList.toggle("hide", false)
        return
      }
    } else {
      const { metadata } = playerEl.codec
      // console.log(metadata)
      if (metadata?.title) {
        const artist = metadata.author ?? metadata.artist
        setTrackTitle(artist ? `${artist} - ${metadata.title}` : metadata.title)
      }
    }

    trackCoverEl.parentElement.classList.toggle("hide", true)
  }

  function changeChain(e, target) {
    chainEl.firstChild.value = target.value
    state.chain = target.value
    applyChain()
  }

  function applyChain() {
    playerEl.loop = state.chain === "loop"

    if (app.file) {
      app.file.adjacents.loop = state.chain === "loop-all"
      app.file.adjacents.random = state.chain === "shuffle"
      app.file.adjacents.registerButtons(prevBtn, nextBtn)
    }
  }

  app
    .once("ready", () => {
      if ("moveBefore" in Element.prototype) {
        app.dialogEl.addEventListener(
          "ui:dialog.before-remove",
          () => {
            if (!playerEl.mediaEl.isConnected) return
            // @ts-ignore
            document.documentElement.moveBefore(playerEl.mediaEl, document.body)
            playerEl.mediaEl.classList.toggle("hide", true)
          },
          { once: true },
        )
      }
    })
    .on("decode", async (fileAgent) => {
      // Dropping a folder gives a directory path, not a file -- load()
      // would otherwise crash trying to read it as one (EISDIR). Resolve to
      // the first playable file inside instead (recursing into
      // subfolders), before .adjacents is touched below: it derives its
      // sibling list from fileAgent.path's *directory*, so this needs to
      // happen first, or it'd scan the dropped folder's parent instead of
      // its contents.
      if (fileIndex.isDir(fileAgent.path)) {
        const firstPlayable = fileIndex
          .readDir(fileAgent.path, { recursive: true, absolute: true })
          .find((path) => {
            const { mimetype } = os.mimetypes.lookup(path)
            return (
              mimetype?.startsWith("audio/") || mimetype?.startsWith("video/")
            )
          })
        if (!firstPlayable) {
          os.toast(`No playable file found in "${getBasename(fileAgent.path)}"`)
          playerEl.removeAttribute("aria-busy")
          return
        }
        fileAgent.path = firstPlayable
      }

      applyChain()
      fileAgent.adjacents.registerButtons(prevBtn, nextBtn)
      playerEl.removeAttribute("aria-busy")

      setTrackTitle(getBasename(app.file.path))
      if (trackCoverEl.src.startsWith("blob:")) trackCoverEl.src = TRANSPARENT
      // Read by player.js's initChipPlayerCodec (MIDI only) so a freshly
      // created engine starts with the right soundfont already loaded,
      // instead of the built-in fallback + an audible swap moments later.
      state.soundfont = resolveSoundfontValue(state.soundfont)
      playerEl.soundfont = state.soundfont
      const requestedSoundfont = state.soundfont

      // Reapply the persisted MIDI Device choice + current volume before
      // playback actually starts (see player.js's `beforePlay` hook) -- not
      // just when Settings is open -- so switching tracks doesn't silently
      // fall back to the softsynth (audibly, even if briefly) until the
      // user reopens the dialog. MIDI only: `beforePlay` is never awaited
      // for native <video>/<audio> playback -- player.js's load() takes an
      // early `return super.load(...)` for that path, before the
      // `if (this.beforePlay) await this.beforePlay()` line even runs. See
      // the `playerEl.codec === playerEl.mediaEl` block after
      // `playerEl.load()` below for that path's per-track setup instead.
      playerEl.beforePlay = async () => {
        const { codec } = playerEl

        if (codec?.type !== "midi") return
        await applyPersistedSynthEngine(codec, state)
        codec.setMidiVolume(playerEl.muted ? 0 : playerEl.volume)

        // Keeps the device selection in sync for any later device-list
        // update too (e.g. Settings re-enumerating), not just this first
        // application. Attached once per codec instance (it's reused
        // across track loads, so re-decode would otherwise stack up
        // duplicate listeners); a fresh codec after a crash/recreate gets
        // its own fresh listener.
        if (!codec.midiDeviceSyncAttached) {
          codec.midiDeviceSyncAttached = true
          codec.on("state", (newState) => {
            const def = newState.paramDefs?.find((p) => p.id === "mididevice")
            if (def) applyPersistedMidiDevice(codec, state, def)
          })
        }

        // tp_load_soundfont() can cleanly fail (err === -1, not a WASM
        // trap) once the leaked heap runs out of room -- see MIDIPlayer.js's
        // _loadSoundfont(). Recovery means a full destroy/recreate (force:
        // true skips the same-type reuse in player.js's load()), reloading
        // the current track fresh.
        if (!codec.crashRecoveryAttached) {
          codec.crashRecoveryAttached = true
          codec.on("crashed", async (data) => {
            os.toast(data?.message ?? "Player crashed -- reloading.", {
              label: app.manifest.name,
              picto: os.apps.getAppIcon(app.manifest, "16x16"),
            })
            await playerEl.load(app.file.path, { force: true })
            // The fresh codec is a new object -- if Settings was open, its
            // event handlers still close over the destroyed one, same as
            // the stale-dialog check in the "decode" handler above but for
            // a recreate that didn't go through a track/file change.
            if (settingsPromise && settingsCodec !== playerEl.codec) {
              openSettingsForCodec(playerEl.codec, { silent: true })
            }
          })
        }
      }

      const res = await playerEl.load(fileAgent.path)
      if (res !== false) setMetadata(fileAgent)

      // A-B loop points are tied to one specific file's timeline, so they
      // don't make sense carried over to whatever loads next -- reset on
      // *every* track change, not just native audio/video ones. Was
      // previously only reset inside the `codec === mediaEl` branch below,
      // which left ephemeral.loopActive stuck true from a native track
      // straight through to a MIDI one loaded right after (that branch
      // never runs for MIDI at all) -- harmless on its own (nothing reads
      // it while a non-native codec is active), but still stale, incorrect
      // state sitting around, and worth not leaving in place now that it's
      // been noticed.
      resetLoop(playerEl, ephemeral)

      // Native <video>/<audio> playback (see basicPlayer.js's loaded() for
      // where codec.type gets set to "audio"/"video" for it) -- a fresh
      // <src> load resets playbackRate/preservesPitch back to their native
      // defaults, so these need reapplying every track, same idea as MIDI's
      // beforePlay hook above but placed here instead: beforePlay is never
      // awaited for this path (see the comment on it above), while this
      // line always runs regardless of which codec.load() took.
      if (playerEl.codec === playerEl.mediaEl) {
        playerEl.codec.playbackRate = ephemeral.speed ?? 1
        setPreservesPitch(playerEl.codec, ephemeral.preservesPitch ?? true)
        ensureLoopSeekListener(playerEl, ephemeral)
        ensureLoopStopHook(playerEl, ephemeral)
        // Same codec object (the shared <video> element) across every
        // native track change means the "codec changed, rebuild the
        // dialog" reconciliation below never fires here -- an already-open
        // Settings dialog needs telling directly that resetLoop() just
        // cleared the A/B state, or its buttons would keep showing the
        // previous track's loop as still armed. No-op if Settings isn't
        // open on this dialog right now (undefined hook).
        playerEl.refreshLoopButtons?.()
      }

      // If Settings is open and this track's file type differs from the
      // one it was opened for, swap it for the right dialog instead of
      // leaving it open on a codec that's no longer active. Same-type
      // track changes reuse the same codec instance, so this only trips on
      // a genuine type change, not on every track. Silent: this is an
      // automatic reconciliation, not a user asking for settings that
      // might not exist for the new type.
      if (settingsPromise && settingsCodec !== playerEl.codec) {
        openSettingsForCodec(playerEl.codec, { silent: true })
      }

      // resolveSoundfontValue() only catches a stale reference against its
      // own (glob'd-at-launch) file list -- it can't see a file that got
      // deleted from disk after that. If the actual fetch 404'd, the codec
      // already recovered by loading its own fallback; fix the persisted
      // preference too so every future track doesn't keep retrying the
      // same dead path.
      if (playerEl.codec?.soundfontFallback) {
        state.soundfont = playerEl.codec.soundfontFallback
        playerEl.codec.soundfontFallback = null
        os.toast(
          `Soundfont "${requestedSoundfont}" not found -- using ${state.soundfont} instead.`,
          {
            label: app.manifest.name,
            picto: os.apps.getAppIcon(app.manifest, "16x16"),
          },
        )
      }
    })

  let video = false

  if (app.file) {
    const { mimetype } = os.mimetypes.lookup(app.file.path)
    if (mimetype?.startsWith("video/")) video = true
  }

  return {
    tag: "ui-player.app__media__player",
    audioContext: os.mixer.context,
    autoplay: app.config.play !== false,
    loop: app.config.loop,
    volume: app.config.volume,
    mixer: false,
    aria: { busy: true },
    video,
    created(el) {
      playerEl = el

      playerEl.amp.disconnect()
      os.mixer.addTrack(playerEl.amp, { app, fadeIn: 0 })

      if (!app.file) {
        playerEl.removeAttribute("aria-busy")
        app.resize({ animate: false })
      }
    },
    on: {
      "ui:player.loaded": () => {
        const isVideo = playerEl.hasAttribute("video")
        if (isVideo || sizedVideo !== isVideo) {
          app.resize({ animate: false })
        }
        sizedVideo = isVideo
      },
      "ui:player.ended": () => {
        if (state.chain !== "play-one") {
          app.file.adjacents.next()
        }
      },
    },
    controls: [
      {
        tag: ".rows.grow.h-full.gap-xxs",
        content: [
          {
            tag: ".app__media__audio-metadata.cols.gap-xxxs",
            content: [
              {
                tag: ".app__media__audio-cover.hide.inset.screen.shrink._overlap.ratio",
                content: [
                  {
                    tag: "img.fit-contain",
                    src: TRANSPARENT,
                    created(el) {
                      trackCoverEl = el
                    },
                  },
                ],
              },
              {
                tag: ".app__media__audio-title.screen.inset.pa-sm.txt-zwsp.truncate",
                content: "",
                created(el) {
                  trackTitleEl = el
                },
              },
              {
                tag: "ui-scope.app__media__audio-scope",
                created(el) {
                  el.audioInput = playerEl.amp
                },
              },
            ],
          },
          {
            tag: ".cols.shrink",
            content: ["seek"],
          },
          {
            tag: ".app__media__controls.flex.shrink.items-center.gap-xs",
            content: [
              "play",
              "stop",
              {
                tag: ".cols",
                content: [
                  {
                    tag: "button.ui-player__prev._clear",
                    picto: "backward",
                    disabled: true,
                    action: () => app.file.adjacents.prev(),
                    created(el) {
                      prevBtn = el
                    },
                  },
                  {
                    tag: "button.ui-player__next._clear",
                    picto: "forward",
                    disabled: true,
                    action: () => app.file.adjacents.next(),
                    created(el) {
                      nextBtn = el
                    },
                  },
                ],
              },
              {
                tag: "button.ui-player__eject._clear",
                picto: "eject",
                on: { click: () => app.openFile() },
              },

              "elapsed",
              "/",
              "duration",
              { tag: ".ma-r-auto" },
              // "seek",
              // "loop",
              {
                tag: "button.ui-player__chain._clear",
                picto: state.chain,
                created(el) {
                  chainEl = el
                },
                menu: [
                  {
                    tag: "radio",
                    checked: () => state.chain === "play-all",
                    name: app.id + "__chain",
                    picto: "play-all",
                    value: "play-all",
                    label: "Play all tracks",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "play-one",
                    name: app.id + "__chain",
                    picto: "play-one",
                    value: "play-one",
                    label: "Play single track",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "loop-all",
                    name: app.id + "__chain",
                    picto: "loop-all",
                    value: "loop-all",
                    label: "Loop all tracks",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "loop",
                    name: app.id + "__chain",
                    picto: "loop",
                    value: "loop",
                    label: "Loop single track",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "shuffle",
                    name: app.id + "__chain",
                    picto: "shuffle",
                    value: "shuffle",
                    label: "Shuffle",
                    action: changeChain,
                  },
                ],
              },
              {
                tag: "button.ui-player__settings._clear",
                picto: "cog",
                on: {
                  click: () => {
                    if (settingsDialogEl) {
                      settingsDialogEl.activate()
                      return
                    }
                    if (settingsPromise) return
                    openSettingsForCodec(playerEl.codec)
                  },
                },
              },
              "mute",
              "volume",
            ],
          },
        ],
      },
    ],
  }
}
