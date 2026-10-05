import { getParamModulation } from "../paramModulation.js"
import { Emitter } from "../../class/Emitter.js"
import { audioParamTargets } from "../audioParamTargets.js"

function restoreDestinations(track, destinations) {
  for (const destination of destinations) {
    if (!track.destinations.has(destination)) track.connect(destination)
  }
}

/** A view of existing mixer routes, shared by visual and keyboard patching. */
export class AudioPatchGraph extends Emitter {
  constructor(mixer) {
    super()
    this.mixer = mixer
    this.controller = new AbortController()
    const { signal } = this.controller
    const watch = (track) => {
      const controller = new AbortController()
      const trackSignal = AbortSignal.any([signal, controller.signal])
      track.destinations.on("change", { signal: trackSignal }, () =>
        this.emit("change"),
      )
      track.effects.on("change", { signal: trackSignal }, () =>
        this.emit("change"),
      )
      track.on("destroy", { signal: trackSignal }, () => {
        this.emit("trackClosing", track)
        controller.abort()
        for (const source of this.tracks()) {
          if (source !== track && source.destinations.has(track)) {
            source.disconnect(track)
          }
        }
        this.emit("change")
      })
    }
    for (const track of this.tracks()) watch(track)
    for (const map of [mixer.tracks, mixer.effectTracks]) {
      map.on("add", { signal }, watch)
      map.on("change", { signal }, () => this.emit("change"))
    }
    mixer.on("trackRestart", { signal }, (oldTrack, newTrack) => {
      watch(newTrack)
      this.emit("change")
    })
  }

  *tracks() {
    yield this.mixer.mainTrack
    yield* this.mixer.tracks.values()
    yield* this.mixer.effectTracks.values()
  }

  connections() {
    const edges = []
    const params = new Set(audioParamTargets.values())
    for (const source of this.tracks()) {
      for (const target of source.destinations) {
        if (target.isMainTrack || target.destinations || params.has(target)) {
          edges.push({ source, target })
        }
      }
    }
    let source = this.mixer.mainTrack
    for (const pipe of this.mixer.mainTrack.effects) {
      const target = [...this.mixer.effectTracks.values()].find(
        (track) => track.app?.audioPipe === pipe,
      )
      if (!target) continue
      edges.push({ source, target, insert: true })
      source = target
    }
    return edges
  }

  connect(source, target) {
    if (source === target || source.willDestroy || target.willDestroy) {
      return false
    }
    if (source.hasAudioOutput === false) return false
    if (source.destinations.has(target)) return false
    if (target.app?.audioInputs) target.app.audioInputs.add(source)
    else source.connect(target)
    return true
  }

  disconnect({ source, target, insert }) {
    if (insert) source = this.mixer.mainTrack
    if (target.app?.audioInputs?.has(source)) {
      target.app.audioInputs.delete(source)
    } else if (source.destinations.has(target)) source.disconnect(target)
  }

  /** Exclude unavailable effects and either endpoint of the edited cable. */
  canInsertEffect({ source, target }, effect) {
    return (
      [...this.tracks()].includes(effect) &&
      effect.isEffectTrack &&
      effect.hasAudioOutput !== false &&
      !effect.willDestroy &&
      !source.willDestroy &&
      !target.willDestroy &&
      effect !== source &&
      effect !== target
    )
  }

  /** Insert an effect into a live route, optionally retaining its other routes. */
  async insertEffect(edge, effect, preserve = false) {
    const { source, target } = edge
    const current = this.connections().find(
      (item) => item.source === source && item.target === target,
    )
    if (!current || !this.canInsertEffect(edge, effect)) return false

    const cable = getParamModulation(source, target)
    const settings = cable && {
      depth: cable.depth,
      offsetValue: cable.offsetValue,
    }
    const sourceDestinations = [...source.destinations]
    const effectDestinations = preserve ? [...effect.destinations] : []
    if (!preserve) {
      for (const route of this.connections()) {
        if (route.source === effect || route.target === effect) {
          this.disconnect(route)
        }
      }
      // Include inputs queued while an effect was being initialized or bypassed.
      effect.app?.audioInputs?.clear()
      effect.disconnect()
    }
    if (effect.app?.bypassed) effect.app.bypassed = false

    if (current.insert) {
      this.connect(this.mixer.mainTrack, effect)
      await effect.app?.trackReady
      const pipes = [...this.mixer.mainTrack.effects].filter(
        (pipe) => pipe !== effect.app.audioPipe,
      )
      pipes.splice(pipes.indexOf(target.app.audioPipe), 0, effect.app.audioPipe)
      this.mixer.mainTrack.effects.clearSilent()
      for (const pipe of pipes) this.mixer.mainTrack.effects.addSilent(pipe)
      this.mixer.mainTrack.flushEffectChain()
      this.emit("change")
      return true
    }

    // Split the selected cable before attaching either replacement endpoint.
    // AudioApp may temporarily restore a Main route when an input is removed.
    this.disconnect(edge)
    this.connect(source, effect)
    await effect.app?.trackReady
    this.connect(effect, target)
    await target.app?.trackReady
    if (
      source.destinations.has(this.mixer.mainTrack) &&
      (target === this.mixer.mainTrack ||
        !sourceDestinations.includes(this.mixer.mainTrack))
    ) {
      source.disconnect(this.mixer.mainTrack)
    }
    restoreDestinations(
      source,
      sourceDestinations.filter((item) => item !== target),
    )
    restoreDestinations(effect, effectDestinations)
    const replacement = getParamModulation(effect, target)
    if (replacement && settings) Object.assign(replacement, settings)
    this.emit("change")
    return true
  }

  removeParam(param) {
    for (const source of this.tracks()) {
      if (source.destinations.has(param)) source.disconnect(param)
    }
  }

  destroy() {
    this.controller.abort()
    this.off("*")
  }
}
