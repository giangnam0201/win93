import Loop from "../core/Loop.js";
import Sprite from "./Sprite.js";

export default class Game {
  constructor({ width, height, fps, speed } = {}) {
    this.screen = new Sprite({
      name: "screen",
      width,
      height,
      game: this,
      alpha: false,
    });
    this.loop = new Loop(dt => this.screen.update(dt), { fps, speed });
    this.scenes = new Map();
    this._timers = new Set();
  }

  get el() {
    return this.screen.canvas;
  }

  sleep(n) {
    return new Promise(resolve => {
      const timer = window.setTimeout(() => {
        this._timers.delete(timer);
        resolve();
      }, n / this.loop.speed);
      this._timers.add(timer);
    });
  }

  play() {
    this.loop.play();
    this.screen.play();
  }

  clearTimeout() {
    this._timers.forEach(window.clearTimeout);
    this._timers.clear();
  }

  stop() {
    this.clearTimeout();
    this.screen.empty();
    this.screen.clear();
    this.screen.stop();
    this.loop.stop();
  }

  destroy() {
    this.stop();
    this.loop.destroy();
  }
}
