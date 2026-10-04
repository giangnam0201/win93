export const dbToGain = (db) => 10 ** (db / 20)

export const gainToDb = (g) => Math.log10(g) * 20

export function makeDbLinearCurve(start, end, samples = 128, minGain = 0.001) {
  // clamp to avoid zero
  start = Math.max(start, minGain)
  end = Math.max(end, minGain)

  const startDb = gainToDb(start)
  const endDb = gainToDb(end)

  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const db = startDb + (endDb - startDb) * t // linear in dB
    curve[i] = dbToGain(db)
  }
  return curve
}
