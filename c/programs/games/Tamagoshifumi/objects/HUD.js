const DECK = ["drink", "food", "love", "train", "poo"];
export default class HUD {
  constructor(scene) {
    this.scene = scene;

    this.makeBar(1);
    this.ko = this.scene.add.image(52, 4, "ko").setOrigin(0, 0);
    this.makeBar(2);

    this.shadow2.x = 61;
    this.bar2.x = 60;
    this.hp2.setOrigin(0, 0);
    this.hp1.x = 45 + 6;
    this.hp2.x = 60;

    this.deck1 = scene.add.container(6, 0);
    this.deck2 = scene.add.container(0, 0);

    this.container = scene.add.container(0, -20);
    this.container.add(this.deck1);
    this.container.add(this.shadow1);
    this.container.add(this.bar1);
    this.container.add(this.hp1);

    this.container.add(this.deck2);
    this.container.add(this.shadow2);
    this.container.add(this.bar2);
    this.container.add(this.hp2);
    this.container.add(this.ko);

    this.deck();
  }

  deck() {
    this.deck1.removeAll();
    this.deck2.removeAll();

    const display = (deck, item) => {
      if (DECK.includes(item)) {
        const img = this.scene.add.image(x, 6, `${item}_8`).setOrigin(0, 0);
        deck.add(img);
        x += img.width + 1;
      }
    };

    let x = 0;
    let i = 0;
    player.deck.forEach(item => display(this.deck1, item));
    for (i = 0; i < player.poo; i++) display(this.deck1, "poo");

    i = 0;
    x = 0;
    rival.deck.forEach(item => display(this.deck2, item));
    for (i = 0; i < rival.poo; i++) display(this.deck2, "poo");

    this.deck2.x = 62 + 45 - x;
  }

  update() {
    this.deck();
    this.hp(1, player.bar());
    this.hp(2, rival.bar());
  }

  in(initial) {
    if (initial) {
      this.scene.time.delayedCall(130, () => {
        this.hp(1, 1);
        this.hp(2, 1);
      });
    }

    this.container.y = -20;
    this.scene.tweens.add({
      targets: this.container,
      y: 0,
      duration: 300,
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

  makeBar(n) {
    const shadow1 = this.scene.make.graphics({ x: 0, y: 0, add: false });
    shadow1.fillStyle(0x000000);
    shadow1.fillRect(0, 0, 45, 2);
    shadow1.generateTexture(`shadow${n}`, 45, 2);
    this[`shadow${n}`] = this.scene.add
      .image(7, 6, `shadow${n}`)
      .setOrigin(0, 0);
    this[`shadow${n}`].alpha = 0.6;
    this[`shadow${n}`].depth = 600;

    const bar1 = this.scene.make.graphics({ x: 0, y: 0, add: false });
    bar1.fillStyle(0xff00ff);
    bar1.fillRect(0, 0, 45, 2);
    bar1.generateTexture(`bar${n}`, 45, 2);
    this[`bar${n}`] = this.scene.add.image(6, 5, `bar${n}`).setOrigin(0, 0);
    this[`bar${n}`].depth = 601;

    const hp1 = this.scene.make.graphics({ x: 0, y: 0, add: false });
    hp1.fillStyle(0x00ff00);
    hp1.fillRect(0, 0, 45, 2);
    hp1.generateTexture(`hp${n}`, 45, 2);

    this[`hp${n}`] = this.scene.add.image(6, 5, `hp${n}`).setOrigin(1, 0);
    this[`hp${n}`].scaleX = 0;
    this[`hp${n}`].depth = 602;
  }

  hp(n, scaleX) {
    this.scene.add.tween({
      targets: this[`hp${n}`],
      scaleX,
      duration: 300,
    });
  }
}
