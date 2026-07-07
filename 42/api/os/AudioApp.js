import "../../ui/layout/tabs.js"
import { App } from "./App.js"
import { mixer } from "../../lib/audio/mixer.js"
import { WatchSet } from "../../lib/structure/WatchSet.js"
import { defer } from "../../lib/type/promise/defer.js"
import { isInstanceOf } from "../../lib/type/any/isInstanceOf.js"
import { keyboard } from "../env/device/keyboard.js"
import { selectAudioIO } from "./selectAudioIO.js"

/** @import {AudioMixerTrackBase}  from "../../lib/audio/mixer.js" */

/* MARK: AudioApp
================= */

/** @extends {App<AudioApp>} */
export class AudioApp extends App {
  /** @type {WatchSet<AudioMixerTrackBase>} */
  audioInputs = new WatchSet()

  get mixer() {
    return mixer
  }

  get context() {
    return mixer.context
  }

  /* MARK: audioPipe
  ------------------ */

  /** @type {AudioNode} */
  #audioPipe
  get audioPipe() {
    if (this.parentApp) return this.parentApp.audioPipe
    return this.#audioPipe
  }

  set audioPipe(audioNode) {
    if (this.parentApp) {
      this.parentApp.audioPipe = audioNode
      return
    }

    this.track?.destroy()

    this.#audioPipe = audioNode

    if (!isInstanceOf(audioNode, AudioNode)) {
      this.track = undefined
      return
    }

    try {
      this.#audioPipe.disconnect(mixer.context.destination)
    } catch {}

    this.track = mixer.addEffectTrack(this.#audioPipe, {
      app: this,
      hasAudioOutput: this.manifest.hasAudioOutput,
    })

    this.trackReady.resolve()
  }

  constructor(manifest, options) {
    super(manifest, options)

    if (this.parentApp) return this

    this.trackReady = defer()
    const { signal } = this

    this.initPipe()

    this.config.audioInput = this.config.audioInput
      ? [this.config.audioInput].flat()
      : this.config._.length > 0
        ? [this.config._].flat()
        : undefined

    if (this.config.audioInput) {
      for (const id of this.config.audioInput) {
        if (id === "mainTrack") {
          this.audioInputs.add(mixer.mainTrack)
        } else if (mixer.tracks.has(id)) {
          this.audioInputs.add(mixer.tracks.get(id))
        } else if (mixer.effectTracks.has(id)) {
          this.audioInputs.add(mixer.effectTracks.get(id))
        } else {
          // wait for track to be added in the mixer
          const forgetTracks = mixer.tracks.on(
            "add",
            { off: true, signal },
            (track) => {
              if (track.id === id) {
                this.audioInputs.add(track)
                forgetTracks()
              }
            },
          )

          const forgetEffectTracks = mixer.effectTracks.on(
            "add",
            { off: true, signal },
            (track) => {
              if (track.id === id) {
                this.audioInputs.add(track)
                forgetEffectTracks()
              }
            },
          )
        }
      }
    } else if (options?.audioInput !== false) {
      if (this.signal.aborted) return
      this.selectAudioIO()
    }
  }

  /* MARK: initPipe
  ----------------- */

  skipCheckRoutingLoop = false

  initPipe() {
    const { signal } = this

    this.audioInputs
      .on("add", async (inp) => {
        if (inp === this.track) return
        await this.trackReady

        // Re-check conditions after await
        if (this.signal.aborted) return
        if (inp.signal?.aborted) return
        if (!this.audioInputs.has(inp)) return // Was removed while waiting
        if (!this.#audioPipe) return // Pipe was destroyed

        if (!this.skipCheckRoutingLoop) {
          // Check for potential loop
          const wouldCreateLoop = this.#checkForRoutingLoop(inp)
          if (wouldCreateLoop) {
            const { confirm } = await import("../../ui/layout/dialog.js")
            const proceed = await confirm({
              label: "Routing Warning",
              message: `%md Connecting **${this.name}** to **${inp.name}** may create a feedback loop. This could cause audio issues.\n\nDo you want to proceed?`,
              picto: "warning",
              agree: "Proceed",
              decline: "Cancel",
              discardable: "audio.routing.loop-warning",
            })

            // Re-check after dialog
            if (!proceed || this.signal.aborted || !this.audioInputs.has(inp)) {
              this.audioInputs.delete(inp)
              return
            }
          }
        }

        if (inp.isMainTrack) {
          this.#audioPipe.disconnect()
          inp.effects.add(this.#audioPipe)
        } else {
          inp.on("destroy", { signal }, () => {
            this.audioInputs.delete(inp)
          })

          if (
            this.manifest.hasAudioOutput !== false &&
            inp.destinations.has(mixer.mainTrack) &&
            !keyboard.keys.alt
          ) {
            inp.disconnect(mixer.mainTrack) // denormalize track
          }

          inp.connect(this.track)
        }
      })
      .on("delete", (inp) => {
        if (!this.#bypassed) {
          this.disconnectInput(inp)
          if (
            inp.destinations.size === 0 &&
            !inp.willDestroy &&
            !keyboard.keys.alt
          ) {
            inp.connect(mixer.mainTrack) // renormalize track
          }
        }
      })

    this.on("destroy", () => {
      // First bypass all connections
      this.bypass()

      // Explicitly remove from mainTrack.effects if present
      // This catches cases where bypass() might have missed it
      if (this.#audioPipe && mixer.mainTrack.effects.has(this.#audioPipe)) {
        mixer.mainTrack.effects.delete(this.#audioPipe)
      }

      // Also check via getConnectedInputs as a safety net
      for (const inp of this.getConnectedInputs()) {
        if (inp.isMainTrack && inp.effects?.has(this.#audioPipe)) {
          inp.effects.delete(this.#audioPipe)
        }
      }

      // Disconnect the audio pipe completely
      try {
        this.#audioPipe?.disconnect()
      } catch {}

      this.track?.destroy()
    })
  }

  #checkForRoutingLoop(_targetTrack) {
    // TODO: implement
    return false
  }

  // /**
  //  * Check if connecting to the target track would create a routing loop.
  //  * Uses DFS to detect any cycle in the audio graph.
  //  * @param {AudioMixerTrackBase} targetTrack - The track that wants to connect to this app.
  //  * @returns {boolean} - True if connecting would create a loop.
  //  */
  // #checkForRoutingLoop(targetTrack) {
  //   // No track yet means no possible loop
  //   if (!this.track) return false

  //   // Self-connection is always a loop
  //   if (targetTrack === this.track) return true

  //   // For mainTrack effects, check if our output routes back to mainTrack
  //   if (targetTrack.isMainTrack) {
  //     return this.#canReach(this.track, targetTrack)
  //   }

  //   // For regular track connections, check if our output can reach the target
  //   return this.#canReach(this.track, targetTrack)
  // }

  /**
   * Check if there's a path from startTrack to targetTrack using DFS.
   * @param {AudioMixerTrackBase} startTrack - Starting point of the search.
   * @param {AudioMixerTrackBase} targetTrack - The track we're looking for.
   * @returns {boolean} - True if targetTrack is reachable from startTrack.
   */
  #canReach(startTrack, targetTrack) {
    const visited = new Set()
    const stack = [startTrack]

    while (stack.length > 0) {
      const current = stack.pop()

      // Found a path to target - this would create a loop
      if (current === targetTrack) return true

      // Skip if already visited (handles existing cycles in graph)
      if (visited.has(current)) continue
      visited.add(current)

      // Add all destinations to explore
      if (current.destinations) {
        for (const dest of current.destinations) {
          if (!visited.has(dest)) {
            stack.push(dest)
          }
        }
      }

      // For mainTrack, also check tracks that have effects containing
      // nodes that route to this track (effects are inline in the chain)
      if (current.isMainTrack && current.effects) {
        // Effects on mainTrack eventually output to mainTrack's destinations
        // The loop would be: targetTrack -> this.audioPipe -> this.track -> mainTrack -> targetTrack
        // This is already covered by checking destinations
      }
    }

    return false
  }

  /**
   * Check if any of the track's current destinations can reach the target.
   * @param {AudioMixerTrackBase} track - The track to check destinations from.
   * @param {AudioMixerTrackBase} targetTrack - The target to reach.
   * @returns {boolean} - True if any destination can reach the target.
   */
  #canAnyDestReach(track, targetTrack) {
    if (!track.destinations || track.destinations.size === 0) return false
    for (const dest of track.destinations) {
      if (dest === targetTrack) return true
      if (this.#canReach(dest, targetTrack)) return true
    }
    return false
  }

  /* MARK: Bypass
  --------------- */

  #bypassed = false
  get bypassed() {
    return this.#bypassed
  }
  set bypassed(bool) {
    this.toggleBypass(bool)
  }

  #bypassButton
  #updateBypassButton() {
    if (!this.dialogEl) return
    this.#bypassButton ??= this.dialogEl.querySelector(
      ".ui-dialog__button--bypass",
    )
    if (!this.#bypassButton) return
    this.#bypassButton.ariaPressed = String(!this.#bypassed)
  }

  connectInput(inp) {
    if (inp.isMainTrack) {
      inp.effects.add(this.#audioPipe)
    } else if (this.track && !inp.destinations.has(this.track)) {
      inp.connect(this.track)
    }
  }

  disconnectInput(inp) {
    if (inp.isMainTrack) {
      inp.effects.delete(this.#audioPipe)
    } else if (this.track && inp.destinations.has(this.track)) {
      inp.disconnect(this.track)
    }
  }

  /** @returns {Set<AudioMixerTrackBase>} */
  getConnectedInputs() {
    const inputs = new Set()

    for (const track of mixer.tracks.values()) {
      if (track.destinations.has(this.track)) {
        inputs.add(track)
      }
    }

    for (const track of mixer.effectTracks.values()) {
      if (track !== this.track && track.destinations.has(this.track)) {
        inputs.add(track)
      }
    }

    if (mixer.mainTrack.effects?.has(this.#audioPipe)) {
      inputs.add(mixer.mainTrack)
    }

    return inputs
  }

  #dontUnbypass = new WeakMap()
  bypass() {
    if (this.#bypassed) return
    this.#bypassed = true
    this.#updateBypassButton()

    for (const inp of this.getConnectedInputs()) {
      this.disconnectInput(inp)
      let connected = false
      for (const out of this.track.destinations) {
        if (out === inp) continue
        if (inp.destinations.has(out)) {
          this.#dontUnbypass.set(out, inp)
          continue
        }
        if (
          out === mixer.mainTrack &&
          this.#canAnyDestReach(inp, mixer.mainTrack)
        ) {
          continue
        }
        inp.connect(out)
        connected = true
      }
      // If no suitable output was found (e.g., loop with no exit to mainTrack),
      // renormalize by connecting input directly to mainTrack
      if (
        !connected &&
        inp !== mixer.mainTrack &&
        !this.#canAnyDestReach(inp, mixer.mainTrack)
      ) {
        inp.connect(mixer.mainTrack)
      }
    }
  }

  unbypass() {
    if (!this.#bypassed) return
    this.#bypassed = false
    this.#updateBypassButton()
    for (const inp of this.audioInputs) {
      this.connectInput(inp)
      for (const out of this.track.destinations) {
        if (this.#dontUnbypass.get(out) === inp) {
          this.#dontUnbypass.delete(out)
          continue
        }
        if (!inp.destinations.has(out)) continue
        inp.disconnect(out)
      }
    }
  }

  toggleBypass(force = !this.#bypassed) {
    if (force) this.bypass()
    else this.unbypass()
  }

  /* MARK: selectAudioIO
  -------------------------- */

  /** @type {any} */
  selecting
  async selectAudioIO(options) {
    // if (this.childApp) return this.childApp.selectAudioIO?.(options)

    if (this.selecting) {
      this.selecting.rerender?.()
      this.selecting.activate?.()
      return
    }

    await Promise.all([this.ready, this.trackReady])
    this.selecting = true

    await selectAudioIO(
      {
        current: this.track,
        bucket: this.audioInputs,
        signal: this.signal,
        label: `${this.name} - Audio I/O`,
        picto: this.picto,
        ...options,
      },
      this,
    )

    this.selecting = false

    // const backUp = new Set(this.audioInputs)
    // const res = await selectAudioIO(
    //   {
    //     current: this.track,
    //     bucket: this.audioInputs,
    //     signal: this.signal,
    //     label: `${this.name} - Audio I/O`,
    //     picto: this.picto,
    //     ...options,
    //   },
    //   this,
    // )

    // this.selecting = false

    // if (res === false) {
    //   this.audioInputs.clearSilent()
    //   for (const item of backUp) this.audioInputs.add(item)
    // }
  }
}
