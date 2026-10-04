import { uniq } from "../../type/array/uniq.js"

export class WebglProgramError extends Error {
  constructor(message, glError) {
    glError = uniq(
      glError
        .replaceAll("\x00", "\n")
        .trim()
        .split(/\s*ERROR:\s*/),
    )
      .filter(Boolean)
      .join("\n")

    super(message + "\n" + glError)
    Object.defineProperty(this, "name", { value: "WebglProgramError" })
  }
}

//! Copyright (c) 2015, Brandon Jones. MIT License.
// @src https://github.com/toji/shader-perf/blob/master/async-program.js

export class Program {
  #firstUse
  #vertexShader
  #fragmentShader

  constructor(gl, options) {
    this.gl = gl
    this.program = gl.createProgram()
    this.attribs = null
    this.uniforms = null

    this.#firstUse = true
    this.#vertexShader = null
    this.#fragmentShader = null

    if (options?.vertex) this.compile(options?.vertex, gl.VERTEX_SHADER)
    if (options?.fragment) this.compile(options?.fragment, gl.FRAGMENT_SHADER)

    this.config = options
  }

  compile(source, type = this.gl.FRAGMENT_SHADER) {
    const { gl } = this
    let shader

    switch (type) {
      case gl.VERTEX_SHADER:
        this.#vertexShader = gl.createShader(type)
        shader = this.#vertexShader
        break
      case gl.FRAGMENT_SHADER:
        this.#fragmentShader = gl.createShader(type)
        shader = this.#fragmentShader
        break
      default:
        throw new Error("Invalid Shader Type:", type)
    }

    gl.attachShader(this.program, shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
  }

  // bindAttribLocation(attribLocationMap) {
  //   const { gl } = this

  //   if (attribLocationMap) {
  //     this.attribs = {}
  //     for (const attribName of Object.keys(attribLocationMap)) {
  //       gl.bindAttribLocation(
  //         this.program,
  //         attribLocationMap[attribName],
  //         attribName,
  //       )
  //       this.attribs[attribName] = attribLocationMap[attribName]
  //     }
  //   }
  // }

  link() {
    this.gl.linkProgram(this.program)
  }

  use() {
    const { gl } = this

    // If this is the first time the program has been used do all the error checking and
    // attrib/uniform querying needed.
    if (this.#firstUse) {
      this.#firstUse = false

      if (gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        if (!this.attribs) {
          this.attribs = {}
          const attribCount = gl.getProgramParameter(
            this.program,
            gl.ACTIVE_ATTRIBUTES,
          )
          for (let i = 0; i < attribCount; i++) {
            const attribInfo = gl.getActiveAttrib(this.program, i)
            this.attribs[attribInfo.name] = gl.getAttribLocation(
              this.program,
              attribInfo.name,
            )
          }
        }

        this.uniforms = {}
        const uniformCount = gl.getProgramParameter(
          this.program,
          gl.ACTIVE_UNIFORMS,
        )
        for (let i = 0; i < uniformCount; i++) {
          const uniformInfo = gl.getActiveUniform(this.program, i)
          this.uniforms[uniformInfo.name] = gl.getUniformLocation(
            this.program,
            uniformInfo.name,
          )
        }
      } else {
        let error

        if (
          this.#vertexShader &&
          !gl.getShaderParameter(this.#vertexShader, gl.COMPILE_STATUS)
        ) {
          error = new WebglProgramError(
            "Vertex shader compile error: ",
            gl.getShaderInfoLog(this.#vertexShader),
          )
        } else if (
          this.#fragmentShader &&
          !gl.getShaderParameter(this.#fragmentShader, gl.COMPILE_STATUS)
        ) {
          error = new WebglProgramError(
            "Fragment shader compile error: ",
            gl.getShaderInfoLog(this.#fragmentShader),
          )
        } else {
          error = new WebglProgramError(
            "Program link error: ",
            gl.getProgramInfoLog(this.program),
          )
        }

        gl.deleteProgram(this.program)
        gl.deleteShader(this.#vertexShader)
        gl.deleteShader(this.#fragmentShader)
        this.program = null

        throw error
      }
    }

    gl.useProgram(this.program)
    gl.deleteShader(this.#vertexShader)
    gl.deleteShader(this.#fragmentShader)
  }

  destroy() {
    const { gl } = this
    this.#firstUse = true

    if (this.#vertexShader) {
      this.gl.detachShader(this.program, this.#vertexShader)
    }

    if (this.#fragmentShader) {
      this.gl.detachShader(this.program, this.#fragmentShader)
    }

    gl.deleteProgram(this.program)
    this.program = null
  }
}
