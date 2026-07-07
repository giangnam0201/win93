precision mediump float;
uniform sampler2D texture;
uniform float time;
uniform float aspect;
varying vec2 vUv;

void main() {
  vec2 p = vUv - 0.5;
  vec2 p_aspect = p;
  p_aspect.x *= aspect;
  float r = length(p_aspect);
  float a = atan(p_aspect.y, p_aspect.x) - 3.0;

  float t = time;

  // Animation Control
  // 0.0 - 20.0: Singularity (Gravity pull)
  // 5.0 - 10.0: Transition to Tunnel
  // 20.0+: Infinite Tunnel

  float gravity_phase = smoothstep(0.0, 20.0, t);
  float tunnel_phase = smoothstep(5.0, 10.0, t);

  // --- Phase 1: Singularity UVs ---
  float strength = gravity_phase * 0.8;
  float epsilon = mix(0.3, 0.001, gravity_phase);
  float distortion = strength / (r + epsilon);

  vec2 dir = normalize(p_aspect);
  vec2 offset = dir * distortion;
  offset.x /= aspect;
  vec2 uv_singularity = vUv + offset;

  // Rotate slowly at start, accelerate into singularity
  float rotation = t * gravity_phase * 0.5;
  float s = sin(rotation);
  float c = cos(rotation);
  vec2 centered_uv = uv_singularity - 0.5;
  centered_uv.x *= aspect;
  vec2 rotated_uv = vec2(
    centered_uv.x * c - centered_uv.y * s,
    centered_uv.x * s + centered_uv.y * c
  );
  rotated_uv.x /= aspect;
  uv_singularity = rotated_uv + 0.5;

  // --- Phase 2: Tunnel UVs ---
  // Log-polar mapping for infinite tunnel
  float a_rot = a - rotation;
  float log_r = log(r + 1e-5);

  float wave_active = smoothstep(14.0, 16.0, t);
  float wave = (sin(t * 0.2) * (0.07) * wave_active) + (t * 0.002);

  // Scroll accelerates over time
  // float scroll = (t - 6.5) * (t * 0.0001) * (tunnel_phase + wave) * 200.0;
  float scroll = (t - 8.0) * (tunnel_phase + wave) * 1.0;

  vec2 uv_tunnel;
  // Mirrored mapping: acos(cos(x)) creates a continuous triangle wave 0->PI->0
  // We normalize by PI to get 0->1->0
  uv_tunnel.y = (acos(cos(a_rot)) / 3.14159);
  uv_tunnel.x = log_r * 0.5 + scroll;

  // --- Coordinate Mixing ---
  // Warp from singularity space to tunnel space
  vec2 uv = mix(uv_singularity, uv_tunnel, tunnel_phase - wave);

  // --- Chromatic Aberration ---
  // Strong during singularity, fades to very subtle during tunnel
  float aberration = mix(gravity_phase * 0.01, 0.003, tunnel_phase);

  vec3 color;
  color.r = texture2D(texture, uv + vec2(aberration, 0.0)).r;
  color.g = texture2D(texture, uv).g;
  color.b = texture2D(texture, uv - vec2(aberration, 0.0)).b;

  // --- Hole Fade ---
  // Singularity has a growing black hole, Tunnel has a fixed one.
  float horizon = smoothstep(0.0, 0.4 * gravity_phase, r);
  float tunnel_hole = smoothstep(0.0, 0.2, r);
  float hole = mix(horizon, tunnel_hole, tunnel_phase);

  gl_FragColor = vec4(color * hole, 1.0);
}
