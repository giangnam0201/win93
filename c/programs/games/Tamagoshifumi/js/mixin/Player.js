import { emittable } from "./Emitter.js";

const methods = {
  cancel() {},
  start() {},

  end() {
    this.stop();
    this.emit("end", this);
    return this;
  },

  play(...args) {
    this.emit("play", this);
    this.player.playing = true;
    this.start(...args);
    return this;
  },

  stop() {
    this.player.playing = false;
    this.cancel();
    this.emit("stop", this);
    return this;
  },

  pause() {
    if (this.player.playing) {
      this.player.playing = false;
      this.cancel();
      this.emit("pause", this);
    }
    return this;
  },

  resume() {
    if (!this.player.playing) {
      this.emit("resume", this);
      this.play();
    }
    return this;
  },

  toggle() {
    if (this.player.playing) this.pause();
    else this.resume();
    return this;
  },

  destroy() {
    this.stop();
    this.emit("destroy", this);
    this.off("*");
    return this;
  },
};

export const playable = (el = {}, player) => {
  emittable(el);
  Object.entries(methods).forEach(([key, value]) => {
    if (key in el === false) {
      // el[key] = val
      Object.defineProperty(el, key, {
        value,
        enumerable: false,
        configurable: false,
      });
    }
  });
  el.player = player || el;
};
Object.assign(playable, methods);

export default class Player {
  constructor(player) {
    emittable(this);
    this.player = player || this;
  }

  static make(obj, player) {
    playable(obj, player);
  }
}
Object.assign(Player.prototype, methods);
