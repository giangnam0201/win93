export const DEG_PER_RAD = Math.PI / 180
export const RAD_PER_DEG = 180 / Math.PI

export const degreesToRadians = (degrees) => degrees * DEG_PER_RAD
export const radiansToDegrees = (radians) => radians * RAD_PER_DEG

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const normalize = (value, min, max) => (value - min) / (max - min)
export const lerp = (fraction, min, max) => (max - min) * fraction + min

export const exponential = (value) => (10 ** value - 1) / 9
export const linear = (value) => value
export const logarithmic = (value) => Math.log10(1 + value * 9)

export function scale(value, inMin, inMax, outMin, outMax) {
  value = Math.min(Math.max(value, inMin), inMax)
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function exponentialScale(value, min, max) {
  let val = normalize(value, min, max)
  val = exponential(val)
  return scale(val, 0, 1, min, max)
}

export function logarithmicScale(value, min, max) {
  let val = normalize(value, min, max)
  val = logarithmic(val)
  return scale(val, 0, 1, min, max)
}

export function logScale(value, inMin, inMax, outMin, outMax) {
  value = Math.min(Math.max(value, inMin), inMax)
  outMin = Math.log(outMin)
  outMax = Math.log(outMax)
  const scale = (outMax - outMin) / (inMax - inMin)
  return Math.exp(outMin + scale * (value - inMin))
}
