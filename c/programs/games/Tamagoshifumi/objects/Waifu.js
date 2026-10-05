const IMAGES = [
  "choose_your_character",
  "choose_your_partner",
  "equality",
  "final_boss",
  "next_battle",
  "perso_eva",
  "perso_kent",
  "perso_kuno",
  "perso_marco",
  "perso_queen",
  "perso_shoto",
  "perso_tyfenn",
  "perso_utf8",
  "unlocked",
  "versus",
  "you_lose",
  "you_win",
];

const SOUNDS = [
  "choose_your_character",
  "choose_your_partner",
  "final_boss",
  "next_battle",
  "ok",
  "perso_eva",
  "perso_kent",
  "perso_kuno",
  "perso_marco",
  "perso_queen",
  "perso_shoto",
  "perso_tyfenn",
  "perso_utf8",
  "unlocked",
  "versus",
  "you_lose",
  "you_win",
];

export default class Waifu {
  constructor(scene, text, config) {
    this.scene = scene;
    this.open(text, config);
  }

  open(text, { close, duration } = {}) {
    if (this.image) this.image.destroy();
    if (IMAGES.includes(text)) {
      this.image = this.scene.add.image(55, 30, text);
      this.image.depth = 500;
      this.image.scaleY = 0;
      this.scene.tweens.add({
        targets: this.image,
        scaleY: 1,
        duration: 200,
      });
    }

    this.say(text);

    this.duration = duration || this.audio ? this.audio.duration * 1000 - 200 : 300;

    this.duration = Math.max(400, this.duration);

    if (close === true) {
      this.scene.time.delayedCall(this.duration, () => this.close());
    }
  }

  close() {
    if (this.image) {
      this.scene.tweens.add({
        targets: this.image,
        scaleY: 0,
        duration: 200,
      });
    }
  }

  say(text) {
    if (SOUNDS.includes(text)) {
      this.audio = this.scene.sound.add(text);
      this.audio.play();
    }
  }

  static say(scene, text) {
    if (SOUNDS.includes(text)) {
      scene.sound.add(text).play();
    }
  }

  static preload(scene) {
    IMAGES.forEach(key => {
      scene.load.image(key, `sprites/texts/${key}.png`);
    });
    SOUNDS.forEach(key => {
      scene.load.audio(key, [`sounds/waifu/${key}.mp3`, `sounds/waifu/${key}.ogg`]);
    });
  }
}
