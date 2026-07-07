export default class Stage {
  constructor(scene, key, mute) {
    this.scene = scene;
    this.key = key;

    if (!scene.anims.anims.has(`stage_${key}`)) {
      const atlasTexture = scene.textures.get(`stage_${key}`);

      const frames = scene.anims.generateFrameNames(`stage_${key}`, {
        prefix: "**",
        end: 200,
        zeroPad: 3,
      });

      frames.forEach(frame => {
        const or = atlasTexture.frames[frame.frame].customData;
        frame.duration = or.duration / 1.5;
      });

      scene.anims.create({
        key: `stage_${key}`,
        frames,
        repeat: -1,
      });
    }

    this.sprite = scene.add.sprite(0, 0, `stage_${key}`).setOrigin(0, 0);

    if (scene.anims.get(`stage_${key}`).frames.length) {
      this.sprite.play(`stage_${key}`);
    }

    if (mute !== true) $.music(scene, `stage_${key}`);
  }

  pause() {
    if (this.sprite.anims.currentAnim) {
      this.sprite.anims.currentAnim.pause();
    }
  }
  resume() {
    if (this.sprite.anims.currentAnim) {
      this.sprite.anims.currentAnim.resume();
    }
  }

  static preload(scene, key, mute) {
    if (mute !== true)
      scene.load.audio(`stage_${key}`, [
        `sounds/music/stage_${key}.mp3`,
        `sounds/music/stage_${key}.ogg`,
      ]);

    scene.load.atlas(`stage_${key}`, `sprites/stages/${key}.png`, `sprites/stages/${key}.json`);
  }
}
