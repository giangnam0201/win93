function sign(value) {
  return value >= 0 ? 1 : -1
}

function map(value, istart, istop, ostart, ostop) {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart))
}

function classicDistorsion(k) {
  const nSamples = 44_100
  const curve = new Float32Array(nSamples)
  const deg = Math.PI / 180
  let i = 0
  let x

  for (; i < nSamples; ++i) {
    x = (i * 2) / nSamples - 1
    curve[i] = ((3 + k) * x * 57 * deg) / (Math.PI + k * Math.abs(x))
  }

  return curve
}

function classicDistorsion2(k) {
  const nSamples = 44_100
  const curve = new Float32Array(nSamples)
  const deg = Math.PI / 180
  let i = 0
  let x

  for (; i < nSamples; ++i) {
    x = (i * 2) / nSamples - 1
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
  }

  return curve
}

function smooth(amount, nSamples, wsTable) {
  amount = Math.min(amount, 0.9)
  const k = (2 * amount) / (1 - amount)
  let i
  let x
  for (i = 0; i < nSamples; i++) {
    x = (i * 2) / nSamples - 1
    wsTable[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
}

function fuzz(amount, nSamples, wsTable) {
  let i
  let x
  let y
  const a = 1 - amount
  for (i = 0; i < nSamples; i++) {
    x = (i * 2) / nSamples - 1
    y = x < 0 ? -(Math.abs(x) ** (a + 0.04)) : x ** a
    wsTable[i] = Math.tanh(y * 2)
  }
}

function clean(amount, nSamples, wsTable) {
  let i
  let x
  let y
  let abx
  const a = 1 - amount > 0.99 ? 0.99 : 1 - amount
  for (i = 0; i < nSamples; i++) {
    x = (i * 2) / nSamples - 1
    abx = Math.abs(x)
    if (abx < a) y = abx
    else if (abx > a) {
      y = a + (abx - a) / (1 + ((abx - a) / (1 - a)) ** 2)
    } else if (abx > 1) y = abx
    wsTable[i] = sign(x) * y * (1 / ((a + 1) / 2))
  }
}

function asymetric(amount, nSamples, wsTable) {
  let i
  let x
  for (i = 0; i < nSamples; i++) {
    x = (i * 2) / nSamples - 1
    if (x < -0.089_05) {
      wsTable[i] =
        (-3 / 4) *
          (1 -
            (1 - (Math.abs(x) - 0.032_857)) ** 12 +
            (1 / 3) * (Math.abs(x) - 0.032_847)) +
        0.01
    } else if (x >= -0.089_05 && x < 0.320_018) {
      wsTable[i] = -6.153 * (x * x) + 3.9375 * x
    } else {
      wsTable[i] = 0.630_035
    }
  }
}

function notSoDistorded(a) {
  a = (a + 2) ** 3
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const f = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * f) / (1 + a * Math.abs(f))
  }

  return c
}

function crunch(a) {
  a **= 2
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const f = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * f) / (1 + a * Math.abs(f))
  }

  return c
}

function classA(a) {
  const c = new Float32Array(22_050)
  a = 10 + 3 * a
  for (let d = 0; d < 22_050; d += 1) {
    const e = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * e) / (1 + a * Math.abs(e))
  }

  return c
}

function superClean(a) {
  a = (a + 6) / 4
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const e = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * e) / (1 + a * Math.abs(e))
  }

  return c
}

function vertical(a) {
  a = (a + 2) ** 3
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const e = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * e) / (1 + a * Math.abs(e))
  }

  return c
}

function superFuzz(a) {
  a **= 3
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const e = (2 * d) / 22_050 - 1
    c[d] = ((1 + a) * e) / (1 + a * Math.abs(e))
  }

  return c
}

function noisyHiGain(a) {
  a /= 153
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    c[d] = ((2 * d) / 22_050 - 1 < 0 ? -1 : 1) * a
  }

  return c
}

function hiGainModern(a) {
  a = 1 / (1 + a ** 4)
  const c = new Float32Array(22_050)
  for (let d = 0; d < 22_050; d += 1) {
    const e = (2 * d) / 22_050 - 1
    c[d] = e / (Math.abs(e) + a)
  }

  return c
}

function bezier(t, p0, p1, p2, p3) {
  const cX = 3 * (p1.x - p0.x)
  const bX = 3 * (p2.x - p1.x) - cX
  const aX = p3.x - p0.x - cX - bX

  const cY = 3 * (p1.y - p0.y)
  const bY = 3 * (p2.y - p1.y) - cY
  const aY = p3.y - p0.y - cY - bY

  const x = aX * t ** 3 + bX * t ** 2 + cX * t + p0.x
  const y = aY * t ** 3 + bY * t ** 2 + cY * t + p0.y

  return { x, y }
}

function getBezierCurve() {
  const p0 = { x: 0, y: 100 }
  const p1 = { x: 10, y: 50 }
  const p2 = { x: 0, y: 50 }
  const p3 = { x: 100, y: 0 }

  const nSamples = 44_100
  const accuracy = 1 / nSamples
  const curve = new Float32Array(nSamples)
  let index = 0

  curve[index++] = map(p0.y, 0, 100, 1, -1)

  //
  for (let i = 0; i < 1; i += accuracy) {
    const p = bezier(i, p0, p1, p2, p3)
    curve[index++] = map(p.y, 0, 100, 1, -1)
  }

  return curve
}

export const curves = {
  standard(distorsionValue) {
    return classicDistorsion(distorsionValue)
  },
  standardLower(distorsionValue) {
    return classicDistorsion2(distorsionValue)
  },
  smooth(distorsionValue) {
    const c = new Float32Array(44_100)
    const kTuna = distorsionValue / 1500
    smooth(kTuna, 44_100, c)
    return c
  },
  fuzz(distorsionValue) {
    const c = new Float32Array(44_100)
    const kTuna = distorsionValue / 1500
    fuzz(kTuna, 44_100, c)
    return c
  },
  clean(distorsionValue) {
    const c = new Float32Array(44_100)
    const kTuna = distorsionValue / 1500
    clean(kTuna, 44_100, c)
    return c
  },
  asymetric(distorsionValue) {
    const c = new Float32Array(44_100)
    const kTuna = distorsionValue / 1500
    asymetric(kTuna, 44_100, c)
    return c
  },
  bezier() {
    return getBezierCurve()
  },
  notSoDistorded(distorsionValue) {
    return notSoDistorded(distorsionValue / 150)
  },
  crunch(distorsionValue) {
    return crunch(distorsionValue / 150)
  },
  classA(distorsionValue) {
    return classA(distorsionValue / 150)
  },
  superClean(distorsionValue) {
    return superClean(distorsionValue / 150)
  },
  vertical(distorsionValue) {
    return vertical(distorsionValue / 150)
  },
  superFuzz(distorsionValue) {
    return superFuzz(distorsionValue / 150)
  },
  noisyHiGain(distorsionValue) {
    return noisyHiGain(distorsionValue / 10)
  },
  hiGainModern(distorsionValue) {
    return hiGainModern(distorsionValue / 2)
  },
}
