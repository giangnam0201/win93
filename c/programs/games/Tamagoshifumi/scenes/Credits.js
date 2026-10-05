export default class Credits extends Phaser.Scene {
  constructor() {
    super({ key: "Credits" });
  }

  create() {
    this.cameras.main.height = game.canvas.height;
    this.cameras.main.width = game.canvas.width;
    // this.cameras.main.fadeIn(2500, 255, 255, 255);

    const text = this.add
      .text(55, 60, $.CREDITS, {
        font: "8px digit",
        align: "center",
      })
      .setOrigin(0.5, 0);

    const credits = () => {
      const duration = 30000;
      this.tweens.add({
        targets: text,
        y: -text.height + 67,
        ease: "Linear",
        duration,
      });

      this.time.delayedCall(duration + 3000, () => {
        $.music.fadeOut(this, 9000);
        this.time.delayedCall(2000, () => {
          this.time.delayedCall(2000, () => this.cameras.main.fadeOut(6000));
          this.time.delayedCall(11000, () => $.go(this, "Menu"));
        });
      });
    };

    this.time.delayedCall(500, () => {
      const thanks = this.add
        .text(55, 30, "THANK YOU FOR PLAYING !", {
          font: "8px digit",
          align: "center",
        })
        .setOrigin(0.5, 0.5);
      thanks.alpha = 0;
      this.tweens.timeline({
        targets: thanks,
        ease: "Cubic",
        onComplete: credits,
        tweens: [
          {
            alpha: 1,
            duration: 1500,
            hold: 2000,
          },
          {
            alpha: 0,
            duration: 500,
            hold: 1000,
          },
        ],
      });
    });
  }
}
