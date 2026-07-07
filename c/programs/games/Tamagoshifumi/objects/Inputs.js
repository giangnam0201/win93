const IN = ["kak", "tik", "chtouk"];
// const OUT = ["yiohou", "riiyooho", "gr1"];
const OUT = ["yiohou", "riiyooho"];

export default class Inputs {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, -20);
    this.container.depth = 1000;
    this.p1 = scene.add.container(0, 0);
    this.p2 = scene.add.container(55, 0);
    this.container.add(this.p1);
    this.container.add(this.p2);
  }

  text(text, color) {
    const tt = this.scene.add.bitmapText(10, 0, "hajime", String(text), 8);
    tt.tint = color;
    tt.depth = 200;
    tt.x = 27 - tt.width / 2;
    return tt;
  }

  update(c, m1, m2) {
    const isScore = typeof m1 === "number";
    $.fx(this.scene, Phaser.Utils.Array.GetRandom(IN));
    this.p1.removeAll();
    this.p2.removeAll();
    const ban1 = this.scene.add
      .image(
        -10,
        0,
        c === 0 ? "ban_eq_1" : c === 1 ? "ban_win_1" : "ban_lose_1"
      )
      .setOrigin(0, 0);

    if (m1.super) ban1.tint = 0xffff00;
    if (m1.lover) ban1.tint = 0xee66ee;
    if (isScore) ban1.tint = 0x000000;

    this.picto1 = this.scene.add.image(27, 7, m1.inputs);
    this.p1.add(ban1);
    this.p1.add(
      isScore ? this.text(m1, c === 1 ? 0x00ff00 : 0xff00ff) : this.picto1
    );

    const ban2 = this.scene.add
      .image(76, 0, c === 0 ? "ban_eq_2" : c === 2 ? "ban_win_2" : "ban_lose_2")
      .setOrigin(1, 0);

    if (m2.super) ban2.tint = 0xffff00;
    if (m2.lover) ban2.tint = 0xee66ee;
    if (isScore) ban2.tint = 0x000000;

    this.picto2 = this.scene.add.image(27, 7, m2.inputs);
    this.p2.add(ban2);
    this.p2.add(
      isScore ? this.text(m2, c === 2 ? 0x00ff00 : 0xff00ff) : this.picto2
    );

    this.p1.x = -40;
    this.scene.tweens.add({
      ease: c === 1 ? "Back.easeOut" : "Bounce.easeOut",
      targets: this.p1,
      x: 0,
      duration: 350,
    });
    this.p2.x = 111;
    this.scene.tweens.add({
      ease: c === 2 ? "Back.easeOut" : "Bounce.easeOut",
      targets: this.p2,
      x: 55,
      duration: 350,
    });
  }

  in(c, m1, m2) {
    this.container.y = 25;
    this.update(c, m1, m2);
    this.scene.time.delayedCall(700, () => {
      if (m1.pooped || m2.pooped) {
        $.fx(this.scene, "fart");
        if (m1.pooped) this.picto1.setTexture("POO");
        if (m2.pooped) this.picto2.setTexture("POO");
      } else if (typeof m2 !== "number")
        $.fx(this.scene, Phaser.Utils.Array.GetRandom(OUT));
      this.scene.tweens.add({
        ease: "Cubic.easeIn",
        targets: this.container,
        y: -20,
        duration: 400,
        onComplete: () => {
          this.p1.removeAll();
          this.p2.removeAll();
        },
      });
    });
  }

  out() {
    this.container.y = 0;
    this.scene.tweens.add({
      targets: this.container,
      y: -20,
      duration: 300,
    });
  }
}
