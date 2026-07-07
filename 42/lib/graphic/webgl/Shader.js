/* eslint-disable no-multi-assign */
//! Copyright (c) 2019 halvves. MIT License.
// @src https://github.com/halvves/shaderpen

// @read https://shadertoyunofficial.wordpress.com/2016/07/22/compatibility-issues-in-shadertoy-webglsl/

import { configure } from "../../../api/configure.js"
import { isMobile } from "../../../api/env/isMobile.js"
import { Program } from "./Program.js"

const SHADER_TOY_VERTEX = `\
#version 300 es

in highp vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`
const SHADER_TOY_HEADER = `\
#version 300 es

precision highp float;
precision highp int;

#define HW_PERFORMANCE ${isMobile() ? "0" : "1"}

out vec4 fragColor;\n`

const SHADER_TOY_FOOTER = `\
void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}`

const SHADER_TOY_CHANNEL_NAMES = [
  "iChannel0",
  "iChannel1",
  "iChannel2",
  "iChannel3",
]

const wrappers = {
  shaderToy: {
    vertex: SHADER_TOY_VERTEX,
    header: SHADER_TOY_HEADER,
    footer: SHADER_TOY_FOOTER,
    uniforms: {
      iResolution: {
        type: "vec3",
        // value: [0, 0, globalThis.devicePixelRatio || 1],
        value: [0, 0, 1],
      },
      iMouse: { type: "vec4" },
      iFrame: { type: "int" },
      iTime: { type: "float" },
      iTimeDelta: { type: "float" },
      iChannel0: { type: "sampler2D", value: 0 },
      iChannel1: { type: "sampler2D", value: 1 },
      iChannel2: { type: "sampler2D", value: 2 },
      iChannel3: { type: "sampler2D", value: 3 },
    },
  },
}

export class Shader {
  autoplay = false
  fallbackTexture = undefined

  constructor(gl, source, options) {
    const { canvas } = gl
    this.canvas = canvas

    this.gl = gl

    gl.clearColor(0, 0, 0, 0)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true) // https://jameshfisher.com/2020/10/22/why-is-my-webgl-texture-upside-down/

    // create a 2D quad Vertex Buffer
    this.vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])

    const buffer = (this.buffer = gl.createBuffer())
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW)

    this.uniforms = {}

    this.lastTime = 0

    this.configure(options)

    if (source) this.compile(source, options)
  }

  configure(options = {}) {
    options.uniforms ??= {}
    this.config = configure(
      options?.wrapper in wrappers
        ? wrappers[options.wrapper]
        : wrappers.shaderToy,
      options,
    )
  }

  createFallbackSampler(unit = 0) {
    return {
      texture: this.getFallbackTexture(),
      target: this.gl.TEXTURE_2D,
      unit,
    }
  }

  toSamplerBinding(value, unit = 0) {
    if (
      value &&
      typeof value === "object" &&
      "texture" in value &&
      value.texture
    ) {
      return {
        texture: value.texture,
        target: value.target ?? this.gl.TEXTURE_2D,
        unit: value.unit ?? unit,
      }
    }

    if (typeof WebGLTexture !== "undefined" && value instanceof WebGLTexture) {
      return {
        texture: value,
        target: this.gl.TEXTURE_2D,
        unit,
      }
    }

    return
  }

  resolveSamplerUniform(key, value) {
    const unit = SHADER_TOY_CHANNEL_NAMES.indexOf(key)
    const textureUnit = unit === -1 ? 0 : unit

    return (
      this.toSamplerBinding(value, textureUnit) ??
      this.toSamplerBinding(this.uniforms[key], textureUnit) ??
      this.toSamplerBinding(this.config.channels?.[textureUnit], textureUnit) ??
      this.createFallbackSampler(textureUnit)
    )
  }

  compile(source, options) {
    const { gl } = this

    if (options) this.configure(options)

    let { header, footer, vertex } = this.config

    const uniforms = {}

    const setUniformMethod = (key, type, value) => {
      let method

      if (type.startsWith("vec")) {
        const n = type.at(-1)
        method = `uniform${n}fv`
        value ??= new Array(Number(n)).fill(0)
      } else if (type.startsWith("sampler")) {
        method = "uniform1i"
        const sampler = this.resolveSamplerUniform(key, value)
        uniforms[key] = {
          value: sampler.unit,
          method,
          texture: sampler.texture,
          target: sampler.target,
          unit: sampler.unit,
        }
        return
      } else if (type === "int") {
        method = "uniform1i"
        value ??= 0
      } else {
        method = `uniform1${type[0]}`
        value ??= 0
      }

      if (this.uniforms[key]) value = this.uniforms[key].value

      uniforms[key] = { value, method }
    }

    const declaredUniforms = []
    source.replaceAll(
      /^uniform (?<type>\w+) (?<key>\w+);/gm,
      (_, type, key) => {
        declaredUniforms.push(key)
        setUniformMethod(key, type)
      },
    )

    for (const [key, val] of Object.entries(this.config.uniforms)) {
      if (declaredUniforms.includes(key)) {
        uniforms[key].value = val.value ?? val
      } else {
        const { type, value } = val
        header += `uniform ${type} ${key};\n`
        setUniformMethod(key, type, value)
      }
    }

    this.source = `${header}\n${source}\n${footer}`

    const program = new Program(gl, {
      fragment: this.source,
      vertex,
    })

    program.link()

    // keep playing previous program if an error is thrown
    program.use()

    this.program?.destroy()
    this.program = program
    this.uniforms = uniforms
    this.bindUniforms()
    this.setSize()

    if (this.paused === false) return

    if (this.config.autoplay) this.play()
    else this.render()
  }

  bindUniforms() {
    const { gl } = this
    const { position } = this.program.attribs

    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    this.updates = []

    for (const key of Object.keys(this.program.uniforms)) {
      const location = this.program.uniforms[key]
      const uniform = this.uniforms[key]
      this.updates.push(() => {
        if (uniform.texture) {
          gl.activeTexture(gl.TEXTURE0 + uniform.unit)
          gl.bindTexture(uniform.target ?? gl.TEXTURE_2D, uniform.texture)
        }

        gl[uniform.method](location, uniform.value)
      })
    }
  }

  getFallbackTexture() {
    if (this.fallbackTexture) return this.fallbackTexture

    const { gl } = this
    const texture = gl.createTexture()

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    )
    gl.bindTexture(gl.TEXTURE_2D, null)

    this.fallbackTexture = texture
    return texture
  }

  setSize(width = this.canvas.width, height = this.canvas.height) {
    this.uniforms.iResolution.value[0] = width
    this.uniforms.iResolution.value[1] = height
    this.gl.viewport(0, 0, width, height)
    this.render()
  }

  paused = true
  loop(time) {
    if (this.paused) return
    this.render(time)
    this.rafId = requestAnimationFrame((time) => this.loop(time))
  }

  play() {
    if (this.paused === false) return
    this.paused = false
    this.lastTime = performance.now()
    this.render(this.lastTime)
    this.rafId = requestAnimationFrame((time) => this.loop(time))
  }

  pause() {
    if (this.paused) return
    this.paused = true
    cancelAnimationFrame(this.rafId)
    this.rafId = undefined
  }

  togglePause(force = !this.paused) {
    if (force) this.pause()
    else this.play()
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  resetMouse() {
    if (!this.uniforms.iMouse) return
    this.uniforms.iMouse.value = [0, 0, 0, 0]
  }

  resetTime() {
    this.lastTime = this.paused ? 0 : performance.now()

    if (this.uniforms.iTime) this.uniforms.iTime.value = 0
    if (this.uniforms.iTimeDelta) this.uniforms.iTimeDelta.value = 0
    if (this.uniforms.iFrame) this.uniforms.iFrame.value = 0

    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    for (const update of this.updates) update(0)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  destroy() {
    this.pause()
    this.program?.destroy()
    this.program = undefined

    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer)
      this.buffer = undefined
    }

    if (this.fallbackTexture) {
      this.gl.deleteTexture(this.fallbackTexture)
      this.fallbackTexture = undefined
    }

    this.updates = []
  }

  render(timestamp = this.lastTime) {
    const { gl } = this

    const delta = (timestamp - this.lastTime) / 1000
    this.lastTime = timestamp

    this.uniforms.iTime.value += delta
    this.uniforms.iTimeDelta.value = delta
    this.uniforms.iFrame.value++

    gl.clear(gl.COLOR_BUFFER_BIT)
    for (const update of this.updates) update(delta)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
