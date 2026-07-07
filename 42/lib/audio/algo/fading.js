function untilDuration(param, duration, options) {
  return new Promise((resolve) => {
    const signal = options?.signal
    const timerId = setTimeout(
      () => resolve(true),
      Math.ceil((duration + 0.1) * 1000),
    )
    if (signal) {
      signal.addEventListener("abort", () => {
        param.cancelScheduledValues(0)
        clearTimeout(timerId)
        resolve(false)
      })
    }
  })
}

export function fadeIn(gainNode, duration = 1, options) {
  const minGain = options?.minGain ?? 0.001

  const now = gainNode.context.currentTime
  const param = gainNode.gain
  const start = Math.max(options?.start ?? param.value, minGain)
  const end = 1

  param.cancelScheduledValues(now)

  try {
    param.setValueAtTime(start, now)
    param.exponentialRampToValueAtTime(end, now + Math.max(0.001, duration))
  } catch (err) {
    console.warn(`Audio parameter ramping failed: ${err.message}`)
  }

  return untilDuration(param, duration, options)
}

export function fadeOut(gainNode, duration = 1, options) {
  const minGain = options?.minGain ?? 0.001

  const now = gainNode.context.currentTime
  const param = gainNode.gain
  const start = Math.max(options?.start ?? param.value, minGain)
  const end = minGain

  param.cancelScheduledValues(now)

  try {
    param.setValueAtTime(start, now)
    param.exponentialRampToValueAtTime(end, now + Math.max(0.001, duration))
  } catch (err) {
    console.warn(`Audio parameter ramping failed: ${err.message}`)
  }

  return untilDuration(param, duration, options)
}

export function mute(gainNode, options) {
  const now = gainNode.context.currentTime
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setTargetAtTime(0, now, 0.015)
  return untilDuration(gainNode.gain, 0.015, options)
}

export function unmute(gainNode, options) {
  const now = gainNode.context.currentTime
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setTargetAtTime(1, now, 0.015)
  return untilDuration(gainNode.gain, 0.015, options)
}
