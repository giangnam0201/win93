import { AudioClock } from "../../../../../42/lib/audio/AudioClock.js"

// Matches the range input's neutral 1x playback speed.
const DEFAULT_SPEED = 1
const DEFAULT_PRESERVES_PITCH = true

// preservesPitch is the standardized name; older WebKit/Gecko builds only
// ever shipped the prefixed ones. Checking "in" rather than just always
// setting all three avoids tripping a console warning on engines that
// recognize the property name but not on an element instance for some
// reason.
export function setPreservesPitch(mediaEl, value) {
  if ("preservesPitch" in mediaEl) mediaEl.preservesPitch = value
  else if ("mozPreservesPitch" in mediaEl) mediaEl.mozPreservesPitch = value
  else if ("webkitPreservesPitch" in mediaEl) {
    mediaEl.webkitPreservesPitch = value
  }
}

// The first version of A-B loop polled the "timeupdate" DOM event (fires a
// few times a second, at whatever irregular interval the browser feels
// like -- not tied to the audio clock at all) and jumped back once it
// noticed currentTime had crossed B. Audibly unstable, exactly as
// reported. This schedules the jump against the real audio clock instead,
// same AudioClock (42/lib/audio/AudioClock.js) already used for the Web
// MIDI panic/reset timing fixes -- one instance per player window, lazily
// created the first time a loop is actually armed. toleranceLate is
// widened well past AudioClock's 0.1s default: that default is right for
// "release notes now" (panic/reset -- see project_mediaplayer_webmidi
// memory) but wrong here -- a late loop-boundary callback should still
// fire (plays a bit too long into the next lap, recoverable) rather than
// being silently dropped and leaving the loop just... stopped, which 0.1s
// risks under any real main-thread hiccup.
const loopClocks = new WeakMap()
const loopEvents = new WeakMap()

async function getLoopClock(playerEl) {
  let clock = loopClocks.get(playerEl)
  if (!clock) {
    clock = new AudioClock(playerEl.audioContext, { toleranceLate: 2 })
    loopClocks.set(playerEl, clock)
    await clock.init()
    clock.start()
  }
  return clock
}

export function clearLoopSchedule(playerEl) {
  loopEvents.get(playerEl)?.clear()
  loopEvents.delete(playerEl)
}

// The native seek behind every A->B jump restarts the decoder at the new
// position, which can leave a faint click -- not fixable by scheduling
// precision alone (see the conversation this came from). Ducks the
// player's own output gain node for a handful of milliseconds around the
// seek to mask it: too short to be its own perceptible fade, just long
// enough to cover the click. Same duck-around-a-discontinuity technique
// already used for soundfont switches in settings/midi.js, just much
// shorter (that one covers a slower operation, ~30ms, and can afford to be
// noticeable; this one explicitly can't).
function seekToLoopStartWithDuck(playerEl, loopA, onSeeked) {
  const { amp, audioContext, mediaEl } = playerEl
  const duckTime = 0.006
  const now = audioContext.currentTime
  amp.gain.cancelScheduledValues(now)
  amp.gain.setTargetAtTime(0, now, duckTime / 3)
  setTimeout(() => {
    mediaEl.currentTime = loopA
    const restoreAt = audioContext.currentTime
    amp.gain.cancelScheduledValues(restoreAt)
    amp.gain.setTargetAtTime(
      playerEl.muted ? 0 : playerEl.volume,
      restoreAt,
      duckTime / 3,
    )
    onSeeked?.()
  }, duckTime * 1000)
}

// Schedules the next A->B jump, then re-arms itself after every jump
// (AudioClock events are one-shot). Also the right thing to call after a
// manual seek or a Speed change while the loop is active -- see
// ensureLoopSeekListener() and the Speed slider below -- since either
// invalidates however much "time left until B" was computed the last time.
export async function scheduleLoopCheck(playerEl, ephemeral) {
  clearLoopSchedule(playerEl)
  if (!ephemeral.loopActive || ephemeral.loopB == null) return

  const mediaEl = playerEl.mediaEl
  const rate = mediaEl.playbackRate || 1
  const remainingNow = (ephemeral.loopB - mediaEl.currentTime) / rate

  if (remainingNow <= 0) {
    // Already past B (reactivated late, or a manual seek landed past it) --
    // snap back (ducked) and only compute the next lap's schedule once
    // that's actually landed, not before -- mediaEl.currentTime still
    // reads the old position until the ducked seek's setTimeout fires.
    seekToLoopStartWithDuck(playerEl, ephemeral.loopA, () => {
      scheduleLoopCheck(playerEl, ephemeral)
    })
    return
  }

  const clock = await getLoopClock(playerEl)
  // The loop could have been cleared or reassigned while awaiting the
  // clock's (one-time) async init() above -- don't schedule against state
  // that's no longer current.
  if (!ephemeral.loopActive || ephemeral.loopB == null) return

  const deadline = playerEl.audioContext.currentTime + remainingNow
  loopEvents.set(
    playerEl,
    clock.callbackAtTime(() => {
      if (!ephemeral.loopActive || ephemeral.loopA == null) return
      seekToLoopStartWithDuck(playerEl, ephemeral.loopA, () => {
        scheduleLoopCheck(playerEl, ephemeral)
      })
    }, deadline),
  )
}

// A-B loop points are tied to a specific file's timeline, so -- unlike
// Speed/Preserve Pitch -- they don't make sense carried over to a
// different track. Called from MediaPlayer.js on every new decode, and
// reused by the Clear button below (identical behavior either way).
export function resetLoop(playerEl, ephemeral) {
  clearLoopSchedule(playerEl)
  ephemeral.loopA = null
  ephemeral.loopB = null
  ephemeral.loopActive = false
}

// A manual seek (dragging the scrubber) while the loop is active leaves
// the previously scheduled deadline computed against wherever playback
// was *before* the seek -- reschedule from wherever it actually landed.
// Attached once per <video> element (reused across every track, native or
// not -- see basicPlayer.js's mediaEl), not per codec instance. Called
// from MediaPlayer.js on every new decode, same as resetLoop() above.
export function ensureLoopSeekListener(playerEl, ephemeral) {
  if (playerEl.abLoopSeekAttached) return
  playerEl.abLoopSeekAttached = true
  playerEl.mediaEl.addEventListener("seeked", () => {
    if (ephemeral.loopActive) scheduleLoopCheck(playerEl, ephemeral)
  })
}

// basicPlayer.js's stop() always resets position to 0 -- with a loop
// active, Stop-then-Play should resume at A instead, the same way Play
// after Pause resumes where playback actually was. Wraps the instance
// method once per player window (guarded) rather than touching
// basicPlayer.js itself, which is shared framework code with no A-B loop
// concept of its own. Called from MediaPlayer.js on every new decode, same
// as ensureLoopSeekListener() above.
export function ensureLoopStopHook(playerEl, ephemeral) {
  if (playerEl.abLoopStopPatched) return
  playerEl.abLoopStopPatched = true
  const originalStop = playerEl.stop.bind(playerEl)
  playerEl.stop = (options) => {
    originalStop(options)
    if (
      playerEl.codec === playerEl.mediaEl &&
      ephemeral.loopActive &&
      ephemeral.loopA != null
    ) {
      playerEl.mediaEl.currentTime = ephemeral.loopA
      playerEl.elapsed = ephemeral.loopA
    }
  }
}

/**
 * @param {import("../../../../../42/ui/media/player.js").PlayerComponent} playerEl
 * @param {object} state
 * @param {object} ephemeral Per-window, non-persisted store (see
 * MediaPlayer.js) -- Speed/Preserve Pitch reset to defaults each time the
 * app is opened but stay put across tracks within that same window, same
 * as MIDI's Extras tab. Loop points are the one exception: MediaPlayer.js
 * resets those on every new track (see resetLoop()), not just window open.
 * @returns {{label: string, content: object} | null}
 */
export function buildAudioVideoSettings(playerEl, state, ephemeral) {
  const { codec } = playerEl
  if (!codec || (codec.type !== "audio" && codec.type !== "video")) {
    return null
  }

  const mediaEl = playerEl.mediaEl
  const currentSpeed = ephemeral.speed ?? DEFAULT_SPEED
  const currentPreservesPitch =
    ephemeral.preservesPitch ?? DEFAULT_PRESERVES_PITCH

  let speedInputEl
  let aButtonEl
  let bButtonEl

  // aria-pressed, not a CSS class -- controls.css keys the toggled-button
  // look off [aria-pressed="true"] (see the checkbox/radio/toggle-button
  // rule around --button-toggled-bg), so this is both the correct a11y
  // semantics for a toggle button here and the only thing that actually
  // paints it as "on".
  function updateLoopButtons() {
    if (aButtonEl) {
      aButtonEl.ariaPressed = String(ephemeral.loopA != null)
    }
    if (bButtonEl) {
      bButtonEl.ariaPressed = String(ephemeral.loopActive === true)
    }
  }
  // Settings dialogs for native audio/video reuse the same <video> element
  // (and therefore the same codec object) across every track, so
  // MediaPlayer.js's usual "codec changed, rebuild the dialog" reconciliation
  // never fires on a track change here -- an already-open dialog would
  // otherwise keep showing the previous track's A/B button state even
  // after resetLoop() has already cleared the underlying loop. Ad-hoc hook
  // on playerEl, same pattern as beforePlay -- MediaPlayer.js calls this
  // (if set) right after resetLoop() on every new decode.
  playerEl.refreshLoopButtons = updateLoopButtons

  return {
    label: codec.type === "video" ? "Video Settings" : "Audio Settings",
    content: {
      tag: "fieldset.aligned.grow",
      label: codec.type === "video" ? "Video" : "Audio",
      content: [
        {
          tag: "div",
          content: [
            { tag: "label", for: "av-speed", content: "Speed" },
            {
              tag: ".cols.items-center.gap-xs",
              content: [
                {
                  tag: "input.grow",
                  id: "av-speed",
                  type: "range",
                  name: "speed",
                  label: false,
                  min: 0.25,
                  max: 3,
                  step: 0.05,
                  value: currentSpeed,
                  created: (el) => {
                    speedInputEl = el
                  },
                  on: {
                    input: (e, target) => {
                      const value = Number.parseFloat(target.value)
                      ephemeral.speed = value
                      mediaEl.playbackRate = value
                      // The scheduled loop-boundary deadline (if any) was
                      // computed with the previous rate -- stale now.
                      if (ephemeral.loopActive) {
                        scheduleLoopCheck(playerEl, ephemeral)
                      }
                    },
                  },
                },
                {
                  tag: "button._clear",
                  picto: "arrow-ccw",
                  aria: { label: "Reset speed" },
                  action: () => {
                    speedInputEl.value = String(DEFAULT_SPEED)
                    ephemeral.speed = DEFAULT_SPEED
                    mediaEl.playbackRate = DEFAULT_SPEED
                    if (ephemeral.loopActive) {
                      scheduleLoopCheck(playerEl, ephemeral)
                    }
                  },
                },
              ],
            },
          ],
        },
        {
          tag: "checkbox",
          name: "preservepitch",
          label: "Preserve Pitch",
          hint: "Keep the voice/pitch natural at other speeds, instead of it rising or dropping like a vinyl record played too fast or slow.",
          checked: currentPreservesPitch,
          on: {
            change: (e, target) => {
              ephemeral.preservesPitch = target.checked
              setPreservesPitch(mediaEl, target.checked)
            },
          },
        },
        {
          tag: "div",
          content: [
            { tag: "label", content: "Loop" },
            {
              tag: ".cols.items-center.gap-xs",
              content: [
                {
                  tag: "button",
                  content: "A",
                  aria: {
                    label: "Set loop start to current position",
                    pressed: ephemeral.loopA != null,
                  },
                  created: (el) => {
                    aButtonEl = el
                  },
                  action: () => {
                    // A already set -- clicking it again unmarks it, same
                    // as hitting Clear (there's no such thing as "start"
                    // without an "A" any more than there's a loop without
                    // one).
                    if (ephemeral.loopA != null) {
                      resetLoop(playerEl, ephemeral)
                      updateLoopButtons()
                      return
                    }
                    ephemeral.loopA = mediaEl.currentTime
                    ephemeral.loopB = null
                    ephemeral.loopActive = false
                    clearLoopSchedule(playerEl)
                    updateLoopButtons()
                  },
                },
                {
                  tag: "button",
                  content: "B",
                  aria: {
                    label: "Set loop end and start looping",
                    pressed: ephemeral.loopActive === true,
                  },
                  created: (el) => {
                    bButtonEl = el
                  },
                  action: () => {
                    if (ephemeral.loopA == null) return
                    if (ephemeral.loopActive) {
                      // Currently looping -- just stop. The next B click
                      // re-marks the end fresh (see below), so there's
                      // nothing worth preserving about the old B here.
                      ephemeral.loopActive = false
                      clearLoopSchedule(playerEl)
                    } else {
                      // Not currently looping (fresh after A, or stopped by
                      // a previous B click) -- mark the end at wherever
                      // playback is right now and start looping. Every
                      // (re)activation re-marks: no "resume the exact same
                      // loop without moving B" mode any more -- reusing the
                      // stale end point read as a bug, not the DJ "reloop"
                      // behavior it was meant to be.
                      let a = ephemeral.loopA
                      let b = mediaEl.currentTime
                      if (b < a) [a, b] = [b, a] // "inverser A et B"
                      ephemeral.loopA = a
                      ephemeral.loopB = b
                      ephemeral.loopActive = true
                      scheduleLoopCheck(playerEl, ephemeral)
                    }
                    updateLoopButtons()
                  },
                },
                {
                  tag: "button._clear",
                  picto: "close",
                  aria: { label: "Clear loop" },
                  action: () => {
                    resetLoop(playerEl, ephemeral)
                    updateLoopButtons()
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  }
}
