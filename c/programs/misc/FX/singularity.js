const vs = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fs = await fetch(import.meta.resolve("./singularity.glsl")) //
  .then((r) => r.text())

/**
 * Creates a wormhole effect on the given canvas using the provided image source.
 * @param {HTMLImageElement | HTMLCanvasElement} image - The source image.
 */
export function singularity(image) {
  const canvas = document.createElement("canvas")

  // Use WebGL 2 for NPOT texture support (REPEAT)
  const gl = canvas.getContext("webgl2")
  if (!gl) {
    console.error("WebGL 2 not supported")
    return
  }

  // Resize canvas to match image
  // @ts-ignore
  canvas.width = image.naturalWidth || image.width
  // @ts-ignore
  canvas.height = image.naturalHeight || image.height

  gl.viewport(0, 0, canvas.width, canvas.height)

  /**
   * Compiles a shader.
   * @param {number} type - Gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
   * @param {string} source - Shader source code.
   */
  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
  }

  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(program)
  gl.useProgram(program)

  // Fullscreen quad
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )

  const posLoc = gl.getAttribLocation(program, "position")
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  // Texture
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true) // Fix orientation
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

  const timeLoc = gl.getUniformLocation(program, "time")
  const aspectLoc = gl.getUniformLocation(program, "aspect")
  const startTime = performance.now()

  const loop = () => {
    gl.uniform1f(timeLoc, (performance.now() - startTime) * 0.001)
    gl.uniform1f(aspectLoc, canvas.width / canvas.height)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    requestAnimationFrame(loop)
  }
  loop()

  return canvas
}
