export default class BG {
  constructor(scene, type) {
    this.patt = scene.add
      .tileSprite(0, 0, 111, 60, type || "pattern")
      .setOrigin(0, 0);
    this.patt.dx = 0;
    this.patt.dy = 0;
    if (type) {
      this.update = (t, dt) => {
        this.patt.dx += 5 / dt;
        this.patt.dy += 5 / dt;
        this.patt.tilePositionX = ~~this.patt.dx;
        this.patt.tilePositionY = ~~this.patt.dy;
      };
    } else {
      this.a = scene.add
        .tileSprite(0, 0, 111, 60, "stunfest_bg")
        .setOrigin(0, 0);
      this.b = scene.add
        .tileSprite(0, 0, 111, 60, "stunfest_bg")
        .setOrigin(0, 0);
      this.b.tilePositionX = -50;
      this.b.tilePositionY = 90;

      this.update = (t, dt) => {
        this.patt.dx += 15 / dt;
        this.patt.dy += 15 / dt;
        this.patt.tilePositionX = ~~this.patt.dx;
        this.patt.tilePositionY = ~~this.patt.dy;

        this.a.tilePositionX -= 1;
        this.a.tilePositionY -= 1;
        this.b.tilePositionX += 1;
        this.b.tilePositionY -= 1;
      };
    }
  }

  static preload(scene) {
    scene.load.image("pattern", "sprites/ui/pattern.png");
    scene.load.image("pattern_love", "sprites/ui/pattern_love.png");
    scene.load.image("stunfest_bg", "sprites/ui/stunfest_bg.png");
  }
}
