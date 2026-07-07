// // logResponse gives us a more "musical" frequency response
// // for filter frequency, etc, for a control dial - it gives a
// // 2^x exponential curve response for an input of [0,1], returning [0,1].
// export function logResponse(value) {
//   return (2 ** (value * 4 - 1) - 0.5) / 7.5
// }

export function dippedCurve(value) {
  const a = (1 - value) ** 2
  const b = value ** 2
  return [a, b]
}

export function intermediateCurve(value) {
  const a = 1 - value
  const b = value
  return [a, b]
}

export function constantPowerCurve(value) {
  const a = Math.cos(value * 0.5 * Math.PI)
  const b = Math.cos((1 - value) * 0.5 * Math.PI)
  return [a, b]
}

export function cubicCurve(value, deadzone = 0) {
  let a = 1
  let b = 1

  deadzone = 0.5 - deadzone / 2

  if (value > 1 - deadzone) {
    const t = (1 - value) / (deadzone / 2) / 2
    a = t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  } else if (value < deadzone) {
    const t = value / (deadzone / 2) / 2
    b = t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  }

  return [a, b]
}

export function slowFadeCurve(value, deadzone = 0.1) {
  let a = 1
  let b = 1

  deadzone = 0.5 - deadzone / 2

  if (value > 1 - deadzone) {
    const double = ((1 - value) * 2) / (deadzone * 2)
    a = 3 * double ** 2 - 2 * double ** 3
  } else if (value < deadzone) {
    const double = (value * 2) / (deadzone * 2)
    b = 3 * double ** 2 - 2 * double ** 3
  }

  return [a, b]
}

export function slowCutCurve(value, deadzone = 0.5) {
  return slowFadeCurve(value, deadzone)
}

export function fastCutCurve(value, deadzone = 0.85) {
  return slowFadeCurve(value, deadzone)
}

export function transitionCurve(value, deadzone = 0.01) {
  let a = 1
  let b = 1

  deadzone = 0.5 - deadzone / 2

  if (value > 1 - deadzone) {
    a = (1 - value) / (deadzone / 2) / 2
  } else if (value < deadzone) {
    b = value / (deadzone / 2) / 2
  }

  return [a, b]
}
