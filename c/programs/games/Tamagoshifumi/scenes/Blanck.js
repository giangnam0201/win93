export default class Blanck extends Phaser.Scene {
  constructor() {
    super({ key: "Blanck" });
  }

  create() {
    this.cameras.main.height = game.canvas.height;
    this.cameras.main.width = game.canvas.width;
    this.scene.bringToTop();
    $.music.fadeOut(this, 900);
    this.cameras.main.fadeOut(1000).once("camerafadeoutcomplete", () => {
      $.clear();
      this.sound.stopAll();
    });
  }
}
