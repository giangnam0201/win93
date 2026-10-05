import Player from "../mixin/Player.js";

export default class Timer extends Player {
  constructor(seconds) {
    super();
    this.seconds = seconds;
    this.s = seconds;
    return this;
  }

  loop() {
    if (this.playing) {
      if (this.s < 0) {
        this.cancel();
        this.end();
      } else {
        this.emit("tick", this.s--);
        this.timerId = window.setTimeout(() => this.loop(), 1000);
      }
    }
  }

  cancel() {
    window.clearTimeout(this.timerId);
  }

  start() {
    this.cancel();
    this.loop();
  }
}
