const { navigator } = globalThis

export function isMobile() {
  if (!navigator) return false
  if (navigator.userAgentData) return navigator.userAgentData.mobile
  if ("maxTouchPoints" in navigator) return navigator.maxTouchPoints > 0

  const mQ = matchMedia?.("(pointer:coarse)")
  if (mQ?.media === "(pointer:coarse)") return Boolean(mQ.matches)

  if ("orientation" in globalThis) return true

  return (
    /\b(blackberry|webos|iphone|iemobile)\b/i.test(navigator.userAgent) ||
    /\b(android|windows phone|ipad|ipod)\b/i.test(navigator.userAgent)
  )
}
