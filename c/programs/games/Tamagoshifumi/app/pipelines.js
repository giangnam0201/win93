const Sepia = new Phaser.Class({
  Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,

  initialize: function CustomPipeline(game) {
    Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
      game,
      renderer: game.renderer,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;

varying vec2 outTexCoord;
varying vec4 outTint;

const mat4 coeff = mat4(
  0.393, 0.349, 0.272, 1.0,
  0.796, 0.686, 0.534, 1.0,
  0.189, 0.168, 0.131, 1.0,
  0.05, 0.0, 0.1, 1.0
);

void main()
{
    vec4 texel = texture2D(uMainSampler, outTexCoord);
    texel *= vec4(outTint.rgb * outTint.a, outTint.a);
    gl_FragColor = coeff * texel;
}
`,
    });
  },
});

const Black = new Phaser.Class({
  Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,

  initialize: function CustomPipeline(game) {
    Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
      game,
      renderer: game.renderer,
      fragShader: `
precision mediump float;

uniform sampler2D uMainSampler;

varying vec2 outTexCoord;
varying vec4 outTint;

void main()
{
    vec4 texel = texture2D(uMainSampler, outTexCoord);
    texel *= vec4(outTint.rgb * outTint.a, outTint.a);
    gl_FragColor = vec4(0.19 * texel.a, 0.15 * texel.a, 0.16 * texel.a, texel.a);
}
`,
    });
  },
});

export default game => {
  const sepia = game.renderer.addPipeline("Sepia", new Sepia(game));
  sepia.setFloat2("uResolution", game.config.width, game.config.height);
  const black = game.renderer.addPipeline("Black", new Black(game));
  black.setFloat2("uResolution", game.config.width, game.config.height);
};
