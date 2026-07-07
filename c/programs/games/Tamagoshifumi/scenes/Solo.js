export default class Solo extends Phaser.Scene {
  constructor() {
    super({ key: "Solo" });
  }

  create(type) {
    this.cameras.main.height = game.canvas.height;
    this.cameras.main.width = game.canvas.width;
    const win = type !== "lose";

    $.music(this, win ? "voot" : "malade");
    this.bg = new $.BG(this, "pattern");

    this.list = [];

    const total = player.win + (win ? 0 : 1);

    let cc = 0;
    let current;
    let next;

    if (player.prog) {
      player.prog.forEach((key, i) => {
        const sprite = this.add.container(55 + cc, 30);
        const shadow = this.add.image(1, 1, "mysterious");
        shadow.tint = 0x000000;
        shadow.alpha = 0.3;
        sprite.add(shadow);

        if (i < total) {
          sprite.before = this.add.image(0, 0, `avatar_${key}`);
          sprite.defeated = this.add.image(0, 0, $.blend(this, `avatar_${key}`));
          sprite.after = "mysterious";
          sprite.add(sprite.before);
          sprite.add(sprite.defeated);
        } else {
          sprite.before = this.add.image(0, 0, "mysterious");
          sprite.after = `avatar_${key}`;
          sprite.add(sprite.before);
        }

        this.list.push(sprite);

        cc += 3 + 50;
        if (i === total - 1) {
          current = sprite;
          current.defeated.alpha = 0;
        }
        if (i === total) next = sprite;
      });
    }

    const flip = (sprite, onComplete) => {
      this.tweens.add({
        targets: sprite,
        scaleY: 0,
        duration: 300,
        ease: "Cubic",
        onComplete: () => {
          if (sprite.defeated) sprite.defeated.destroy();
          sprite.before.setTexture(sprite.after);
          this.tweens.add({
            targets: sprite,
            scaleY: 1,
            duration: 300,
            ease: "Cubic",
            onComplete,
          });
        },
      });
    };

    const end = () => this.time.delayedCall(1000, () => $.go(this, "Home"));
    const goNext = () => flip(next, end);

    if (win) {
      this.time.delayedCall(300, () => new $.Waifu(this, "next_battle", { close: true }));

      if (current) {
        const pos = current.x - 55;
        this.list.forEach(sprite => (sprite.x -= pos));

        this.tweens.add({
          targets: current.defeated,
          alpha: 1,
          duration: 800,
        });

        this.time.delayedCall(600, () => {
          this.list.forEach(sprite => {
            this.tweens.add({
              targets: sprite,
              x: sprite.x - 55,
              duration: 800,
              ease: "Cubic",
            });
          });
          goNext();
        });
      } else {
        this.time.delayedCall(900, goNext);
      }
    } else {
      const pos = current.x - 55;
      this.list.forEach(sprite => (sprite.x -= pos));

      this.time.delayedCall(500, () => {
        let cc = 55;
        this.list.forEach(sprite => {
          this.tweens.add({
            targets: sprite,
            x: cc,
            duration: 1000,
            ease: "Cubic",
          });
          cc += 3 + 50;
        });

        this.time.delayedCall(500, () => {
          this.list.forEach((sprite, i) => {
            if (i < total) flip(sprite);
          });

          this.time.delayedCall(1500, () => $.music.fadeOut(this, 370));
          this.time.delayedCall(1900, () => $.restartProg(this));
        });
      });
    }
  }

  update(t, dt) {
    this.bg.update(t, dt);
  }
}
