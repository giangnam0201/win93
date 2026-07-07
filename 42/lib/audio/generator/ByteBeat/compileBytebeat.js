/* eslint-disable no-new-func */

const validationSamples = [
  0, 1, 2, 31, 32, 63, 64, 95, 96, 99, 100, 101, 127, 128, 255, 256, 383, 384,
  499, 500, 511, 512, 767, 768, 999, 1000, 1023, 1024, 2048, 4096, 8191, 10_000,
  16_384, 32_768, 65_535, 65_536, 131_072, 262_144, 524_288, 1_048_575,
  1_048_576, 2_097_152,
]

const defaultSampleRate = 8000

function normalizeMode(mode = "bytebeat") {
  return mode.toLowerCase()
}

function validateGenerator(generator) {
  for (const t of validationSamples) generator(t)
}

function createFallbackGenerator(generator, fallback, onError) {
  let broken = false

  return (...args) => {
    if (broken) return fallback?.(...args) ?? 0

    try {
      return generator(...args)
    } catch (err) {
      broken = true
      onError?.(err)
      return fallback?.(...args) ?? 0
    }
  }
}

export function compileBytebeat(formula, options = {}) {
  const {
    fallback,
    onError,
    mode = "bytebeat",
    sampleRate = defaultSampleRate,
  } = options
  // Optimize code like eval(unescape(escape`XXXX`.replace(/u(..)/g,"$1%")))
  formula = formula
    .trim()
    .replace(
      /^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.{2}\)\/g,["'`]\$1%["'`]\){3}$/,
      (_, m1) => unescape(escape(m1).replaceAll(/u(..)/g, "$1%")),
    )

  const keys = Object.getOwnPropertyNames(Math)
  const values = keys.map((key) => Math[key])
  keys.push("int", "window")
  values.push(Math.floor, globalThis)

  const normalizedMode = normalizeMode(mode)
  const source =
    normalizedMode === "funcbeat" ? formula : `return 0,\n${formula};`

  try {
    let generator

    if (normalizedMode === "funcbeat") {
      const factory = new Function(...keys, source).bind(globalThis, ...values)
      const result = factory()

      if (typeof result !== "function") {
        throw new TypeError("Funcbeat formula must return a function")
      }

      generator = (time, currentSampleRate = sampleRate) =>
        result(time, currentSampleRate)
    } else {
      generator = new Function(...keys, "t", source).bind(globalThis, ...values)
      validateGenerator(generator)
    }

    return fallback || onError
      ? createFallbackGenerator(generator, fallback, onError)
      : generator
  } catch (err) {
    return [err, source]
  }
}
