export default class Shutter {
  constructor(scene, duration = 300) {
    this.scene = scene;
    this.duration = duration;
    const shutter = scene.make.graphics({ x: 0, y: 0, add: false });
    shutter.fillStyle(0x000000);
    shutter.fillRect(0, 0, 111, 30);
    shutter.generateTexture("shutter", 111, 30);
    this.init();
  }

  init() {
    this.up = this.scene.add.image(0, -30, "shutter").setOrigin(0, 0);
    this.up.depth = 300;
    this.down = this.scene.add.image(0, 60, "shutter").setOrigin(0, 0);
    this.down.depth = 300;
  }

  close(duration = this.duration, onComplete) {
    this.scene.tweens.add({
      targets: this.up,
      y: 0,
      ease: "Linear",
      duration,
    });
    this.scene.tweens.add({
      targets: this.down,
      y: 30,
      ease: "Linear",
      duration,
      onComplete,
    });
  }

  open(duration = this.duration, onComplete) {
    this.up.y = 0;
    this.down.y = 30;
    this.scene.tweens.add({
      targets: this.up,
      y: -30,
      ease: "Linear",
      duration,
    });
    this.scene.tweens.add({
      targets: this.down,
      y: 60,
      ease: "Linear",
      duration,
      onComplete,
    });
  }
}
