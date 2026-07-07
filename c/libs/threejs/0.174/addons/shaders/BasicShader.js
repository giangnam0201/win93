/* eslint-disable */

//! Copyright (c) mrdoob. MIT License.
// three - 0.174.0 - https://threejs.org/

/**
 * Simple test shader
 */

const BasicShader = {
  name: "BasicShader",

  uniforms: {},

  vertexShader: /* glsl */ `

		void main() {

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		void main() {

			gl_FragColor = vec4( 1.0, 0.0, 0.0, 0.5 );

		}`,
}

export { BasicShader }
