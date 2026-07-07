// @thanks https://www.shadertoy.com/view/3dd3DX

float generator (int t) {
  int byte = FORMULA;
  return float(byte & 255) / 255.0;
}

const float gridSizeY = 256.0;
const float gridSizeX = 256.0;

uniform float t;

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 gridPos = (fragCoord - vec2(iResolution.x * 0.5, 0)) / iResolution.y;
  gridPos *= vec2(gridSizeX, -gridSizeY);
  gridPos.x += t / gridSizeY;
  gridPos = floor(gridPos);

  float grid = generator(int(gridPos.y) + int(gridSizeY * gridPos.x)) * step(0.0, gridPos.x - 1.0);

  fragColor = vec4(vec3(grid), 1.0);
}
