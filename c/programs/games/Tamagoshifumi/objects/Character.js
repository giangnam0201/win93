const RE_META = /^[>#]/;

export default class Character {
  constructor(scene, key, { auto, mirror, boss } = {}) {
    this.scene = scene;
    this.key = key;
    this.mirror = mirror;
    this.sprite = scene.add.sprite(0, 0, key).setOrigin(0, 0);

    const atlasTexture = scene.textures.get(key);

    const tags = [];
    const events = {};

    const makeEvents = name =>
      name.split(" ").reduce((acc, item) => {
        const a = item[0];
        if (a === "#") {
          acc.push({
            type: "anim",
            data: item.slice(1),
          });
        } else if (a === ">") {
          acc.push({
            type: "fx",
            data: item.slice(1),
          });
        }
        return acc;
      }, []);

    atlasTexture.customData.meta.frameTags.forEach(item => {
      if (RE_META.test(item.name)) {
        if (!(item.from in events)) events[item.from] = [];
        events[item.from].push(...makeEvents(item.name));
      } else {
        tags.push(item.name);
      }
    });

    tags.forEach(move => {
      if (!scene.anims.anims.has(`${key}_${mirror}_${move}`)) {
        const repeat = move === "block" ? 0 : -1;
        const frames = this.scene.anims.generateFrameNames(key, {
          prefix: `${move}**`,
          end: 200,
          zeroPad: 3,
        });

        // console.log(frames);
        // frames.forEach(frame => {
        //   const or = atlasTexture.frames[frame.frame].customData;
        //   frame.duration = or.duration / 1.5;
        //   // console.log(key, frame.duration);
        // });

        const anim = this.scene.anims.create({
          key: `${key}_${mirror}_${move}`,
          frames,
          frameRate: 11,
          repeat,
        });

        anim.frames.forEach(frame => {
          frame.textureFrame.replace(/0*(\d+)/, (_, d) => {
            d = Number(d);
            if (events[d]) frame.meta = events[d];
          });
        });
      }
    });

    if (boss) this.sprite.tint = 0x000000;
    if (mirror) {
      this.sprite.x = 111;
      this.sprite.scaleX = -1;
    }

    if (auto !== false) {
      this.play("in");
    }
  }

  play(move, rivalMove, cb) {
    let type = move;
    if (move === "super") {
      type = $.characters[this.key].moves.super.type;
    }

    if (move === "in") {
      this.sprite.visible = false;
      this.scene.time.delayedCall(500, () => {
        this.sprite.visible = true;
        this.anim("in", 1, cb);
      });
    } else if (type === "block") {
      this.sprite.removeAllListeners();
      this.sprite.depth = 100;
      this.sprite.play(`${this.key}_${this.mirror}_block`);
      this.rival.blocked = () => {
        this.rival.sprite.anims.currentAnim.pause();
        this.rival.blocked = false;
        this.scene.time.delayedCall(250, () => {
          this.rival.sprite.removeAllListeners();
          this.rival.sprite.depth = 100;
          this.rival.sprite.anims.currentAnim.resume();
          this.rival.anim("idle");
          this.anim(move === "super" ? "super" : "attack", 1, cb);
        });
      };
      this.rival.anim(rivalMove === "super" ? "super" : "attack");
    } else if (move === "grab") {
      this.rival.anim("block");
      this.scene.time.delayedCall(250, () => {
        this.rival.sprite.removeAllListeners();
        this.rival.sprite.depth = 100;
        this.anim(move, 1, cb);
      });
    } else if (move === "lover") {
      this.anim("out", 1, () => {
        this.sprite.visible = false;
        if (typeof this.lover === "string") {
          this.lover = new $.Character(this.scene, this.lover, {
            auto: false,
            mirror: this.mirror,
            boss: this.boss,
          });
          this.lover.rival = this.rival;
        }
        this.lover.sprite.visible = true;
        this.lover.anim("in", 1, () => {
          this.lover.play("super", undefined, () => {
            this.lover.anim("out", 1, () => {
              this.lover.sprite.visible = false;
              this.sprite.visible = true;
              this.anim("in", 1, cb);
            });
          });
        });
      });
    } else {
      this.anim(move, 1, cb);
    }
  }

  anim(move, repeat = 1, cb) {
    this.sprite.removeAllListeners();
    this.sprite.depth = 200;
    this.sprite.on("animationupdate", (s, { meta }) => {
      if (meta) {
        meta.forEach(event => {
          if (event.type === "anim") {
            if (this.blocked) this.blocked();
            else {
              if (
                event.data === "hit" ||
                event.data === "kicked" ||
                event.data === "flipped"
              ) {
                this.scene.cameras.main.flash(16);
              }
              this.rival.play(event.data);
            }
          } else if (event.type === "fx") $.fx(this.scene, event.data);
        });
      }
    });
    this.sprite.on("animationrepeat", () => {
      if (--repeat <= 0) {
        this.blocked = false;
        this.sprite.anims.currentAnim.resume();
        this.sprite.removeAllListeners();
        this.sprite.depth = 100;
        this.sprite.play(`${this.key}_${this.mirror}_idle`);
        if (cb) cb();
        // else
      }
    });
    this.sprite.play(`${this.key}_${this.mirror}_${move}`);
  }

  pause() {
    this.sprite.anims.currentAnim.pause();
  }
  resume() {
    this.sprite.anims.currentAnim.resume();
  }

  static preload(scene, key) {
    scene.load.atlas(
      key,
      `sprites/characters/${key}.png`,
      `sprites/characters/${key}.json`
    );
  }
}
