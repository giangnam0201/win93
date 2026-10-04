import { audioParamBindings } from "./audioParamTargets.js"
import { ParamModulationNode } from "./logic/ParamModulationNode.js"

/**
 * Connect a mixer output to a bound control using independent cable settings.
 * @param {import("./mixer.js").AudioMixerTrackBase} source
 * @param {AudioParam} param
 */
export function connectParamModulation(source, param) {
  const binding = audioParamBindings.get(param)
  if (!binding) return
  let { modulation } = binding
  if (!modulation) {
    const base = param.value
    binding.baseValue = base
    param.cancelScheduledValues(0)
    param.value = 0
    const node = new ParamModulationNode(source.context, {
      min: binding.min,
      max: binding.max,
      scale: binding.scale,
      minDb: binding.minDb,
      intrinsic: param.value,
      base,
    })
    node.connect(param)
    modulation = { node, cables: new Map(), fraction: undefined }
    binding.modulation = modulation
    node.port.onmessage = ({ data }) => {
      modulation.fraction = data
      binding.drawModulation(data)
    }
  }
  if (modulation.cables.has(source)) return modulation.cables.get(source)
  const gain = new GainNode(source.context, { gain: 0.5 })
  const offset = new ConstantSourceNode(source.context, { offset: 0 })
  source.output.connect(gain)
  gain.connect(modulation.node)
  offset.connect(modulation.node)
  offset.start()
  const cable = {
    gain,
    offset,
    controller: new AbortController(),
    get depth() {
      return gain.gain.value * 200
    },
    set depth(value) {
      gain.gain.value = value / 200
    },
    get offsetValue() {
      return offset.offset.value * 100
    },
    set offsetValue(value) {
      offset.offset.value = value / 100
    },
  }
  modulation.cables.set(source, cable)
  return cable
}

/**
 * Release one cable and restore the base AudioParam on the last disconnect.
 * @param {import("./mixer.js").AudioMixerTrackBase} source
 * @param {AudioParam} param
 */
export function disconnectParamModulation(source, param) {
  const binding = audioParamBindings.get(param)
  const modulation = binding?.modulation
  const cable = modulation?.cables.get(source)
  if (!cable) return false
  source.output.disconnect(cable.gain)
  cable.gain.disconnect()
  cable.offset.stop()
  cable.offset.disconnect()
  cable.controller.abort()
  modulation.cables.delete(source)
  if (modulation.cables.size === 0) {
    const base = binding.baseValue
    modulation.node.port.onmessage = null
    modulation.node.destroy()
    binding.modulation = undefined
    param.value = base
    binding.drawModulation()
  }
  return true
}

/**
 * Return the editable state of a particular logical cable.
 * @param {import("./mixer.js").AudioMixerTrackBase} source
 * @param {AudioParam} param
 */
export function getParamModulation(source, param) {
  return audioParamBindings.get(param)?.modulation?.cables.get(source)
}
