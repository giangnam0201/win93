// Right-click on a channel toggle: solo it (mute every other channel), or
// if it's already the sole unmuted one, unmute everything back. Mutates
// `mask` in place (matching how every settings/*.js caller already keeps
// its own local mask array) and returns it for convenience.
export function toggleSolo(mask, index) {
  const isSolo = mask.every((on, j) => on === (j === index))
  mask.fill(isSolo)
  if (!isSolo) mask[index] = true
  return mask
}
