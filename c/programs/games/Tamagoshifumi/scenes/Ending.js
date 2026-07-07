export default class Ending extends Phaser.Scene {
  constructor() {
    super({ key: "Ending" });
  }

  create() {
    this.cameras.main.height = game.canvas.height;
    this.cameras.main.width = game.canvas.width;
    const fade = this.make.graphics({ x: 0, y: 0, add: false });
    fade.fillStyle(0xffffff);
    fade.fillRect(0, 0, 111, 60);
    fade.generateTexture("fade", 111, 60);
    this.fade = this.add.image(0, 0, "fade").setOrigin(0, 0);
    this.fade.depth = 200;
    this.add.tween({
      targets: this.fade,
      alpha: 0,
      duration: 5000,
    });

    this.bg = new $.BG(this, "pattern_love");

    $.music(this, "end");

    this.shutter = new $.Shutter(this);

    const { unlocked, ending } = $.end();

    const image = this.add.image(0, -15, `ending_${ending}`).setOrigin(0, 0);

    let step = 0;

    const steps = [
      () => {
        this.tweens.add({
          targets: image,
          y: 0,
          duration: 9000,
          ease: "Quad",
          hold: 7000,
          onComplete: steps[++step],
        });
      },
      () => {
        this.add.tween({
          targets: this.fade,
          alpha: 1,
          duration: 8000,
          onComplete: steps[++step],
        });
      },
      () => {
        image.destroy();
        if (unlocked) {
          this.shutter.close(300, () => {
            this.fade.alpha = 0;
            this.shutter.open();
            this.bg = new $.BG(this);
            const avatar = this.add.image(150, 30, `avatar_transp_${unlocked}`);

            this.tweens.timeline({
              ease: "Power2",
              targets: avatar,
              tweens: [
                {
                  x: 80,
                  duration: 1300,
                  hold: 600,
                },
                {
                  x: 150,
                  duration: 800,
                },
              ],
            });
            this.time.delayedCall(800, () => {
              new $.Waifu(this, "unlocked", { close: true });
              this.time.delayedCall(1500, () => {
                this.shutter.close(400, steps[++step]);
              });
            });
          });
        } else {
          this.time.delayedCall(1500, () => {
            this.shutter.close(400, steps[++step]);
          });
        }
      },
      () => {
        this.fade.alpha = 0;
        $.go(this, "Credits");
      },
    ];

    steps[0]();
  }

  update(t, dt) {
    this.bg.update(t, dt);
  }
}
