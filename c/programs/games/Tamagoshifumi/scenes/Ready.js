export default class Ready extends Phaser.Scene {
  constructor() {
    super({ key: "Ready" });
  }

  create() {
    this.cameras.main.height = game.canvas.height;
    this.cameras.main.width = game.canvas.width;
    this.bg = new $.BG(this);
    $.initRival();
    const p1 = this.add.image(0, 30, `avatar_transp_${player.main}`);
    const p2 = this.add.image(111, 30, `avatar_transp_${rival.main}`);

    p1.setOrigin(1, 0.5);
    p2.setOrigin(0, 0.5);

    this.waifu = new $.Waifu(this);

    $.music.stop();
    $.fx(this, "piouuu");

    this.shutter = new $.Shutter(this);
    this.shutter.open(300, () => {
      this.waifu.open(`perso_${player.main}`, { close: true });
      this.tweens.timeline({
        ease: "Power2",
        targets: p1,
        tweens: [
          {
            x: 55,
            duration: 600,
            hold: 300,
          },
          {
            x: 0,
            duration: 800,
          },
        ],
      });

      this.time.delayedCall(this.waifu.duration + 150, () => {
        this.waifu.open("versus");

        this.time.delayedCall(700, () => {
          if (!rival.boss) {
            this.tweens.timeline({
              ease: "Power2",
              targets: p2,
              tweens: [
                {
                  x: 55,
                  duration: 600,
                  hold: 300,
                },
                {
                  x: 111,
                  duration: 800,
                },
              ],
            });
          }
          this.time.delayedCall(1100, () => {
            $.fx(this, "forward");
            this.shutter.close(300, () => {
              $.go(this, "Versus");
            });
          });
        });
        this.time.delayedCall(this.waifu.duration - 50, () => {
          this.waifu.open(rival.boss ? "final_boss" : `perso_${rival.main}`, {
            close: true,
          });
        });
      });
    });
  }

  update(t, dt) {
    this.bg.update(t, dt);
  }
}
