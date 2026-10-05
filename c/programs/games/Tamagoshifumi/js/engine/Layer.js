import Visual from "./Visual.js";
import Font from "./Font.js";
import Stack from "../core/Stack.js";
import extend from "../extend.js";

export default class Layer extends Visual {
  setup(options) {
    if (options) this.options = options;
    options = this.options;

    if (options.parent) {
      if (!("width" in options)) options.width = options.parent.w;
      if (!("height" in options)) options.height = options.parent.h;
    }

    this._opacity = "1";

    super.setup(options);
    this.setParent(options.parent);

    this.visible = options.visible !== false;
    this.x = "x" in this ? this.x : 0;
    this.y = "y" in this ? this.y : 0;
    this.myX = "myX" in this ? this.myX : 0;
    this.myY = "myY" in this ? this.myY : 0;
    this.atX = "atX" in this ? this.atX : 0;
    this.atY = "atY" in this ? this.atY : 0;

    this.offsetX = 0;
    this.offsetY = 0;
    this.fx = this.fx || [];
    this.transforms = new Set();

    this.drawer = options.shift ? "shift" : this.drawer || "draw";

    if (options.childs && Array.isArray(options.childs)) {
      this.childs = {};
      options.childs.forEach(item => {
        if (options.extend && options.extend[item.name]) {
          this.add(extend({}, options.extend[item.name], item));
        } else this.add(item);
      });
    }

    if (options.transform) {
      Object.entries(options.transform).forEach(([key, val]) => {
        this.transforms.add((dt, sprite) => (sprite[key] += val * dt));
      });
    }
  }

  setParent(parent) {
    if (parent) {
      if (parent.parent) {
        this.parent = parent;
        this.screen = this.parent.screen;
      } else {
        this.parent = parent;
        this.screen = parent;
      }
      if (!this.parent.buffer) this.parent.buffer = this.screen.clone();

      parent.addChild(this);
    }
    return this;
  }

  addChild(instance) {
    if (!this.stack) this.stack = new Stack();
    if (!this.childs) this.childs = {};
    if (!this.stack.has(instance)) this.stack.add(instance);
    this.childs[instance.name] = instance;
    return this;
  }

  add(config, Constructor = this.constructor) {
    if (Array.isArray(config)) {
      config.forEach(item => this.add(item));
      return this;
    }
    let instance;

    if (config instanceof Constructor) {
      instance = config;
      instance.setParent(this);
    } else {
      instance = new Constructor(Object.assign({ parent: this }, config));
    }
    return instance;
  }

  empty() {
    this.stack && this.stack.clear();
    if (this.childs)
      Object.keys(this.childs).forEach(key => delete this.childs[key]);
    return this;
  }

  prerender(dt) {
    this.transforms.forEach(fn => fn(dt, this));
  }

  render(dt, dest = this.screen, buffer = this.parent.buffer) {
    if (!this.visible) return;
    const { offsetX, offsetY, w, h } = this.parent;
    this.offsetX = offsetX + this.x + this.atX * w - this.myX * this.w;
    this.offsetY = offsetY + this.y + this.atY * h - this.myY * this.h;

    // dest.ctx.save();
    // buffer.ctx.save();
    // if (this._mode) {
    //   dest.ctx.globalCompositeOperation = this._mode;
    //   buffer.ctx.globalCompositeOperation = this._mode;
    // }
    if (this._opacity) {
      dest.ctx.globalAlpha = this._opacity;
      buffer.ctx.globalAlpha = this._opacity;
    }

    this.prerender(dt);
    buffer.clear();
    buffer[this.drawer](
      this.canvas,
      this.offsetX,
      this.offsetY,
      this.w,
      this.h
    );

    if (this.stack) this.stack.forEach(item => item.render(dt, buffer));
    this.fx.forEach(([name, ...args]) => Layer.fx[name](buffer, args, this));
    dest.draw(buffer.canvas);

    // dest.ctx.restore();
    // buffer.ctx.restore();
  }

  update(dt) {
    if (this.stack) this.stack.forEach(item => item.render(dt));
  }

  destroy() {
    if (this.parent && this.parent.stack) {
      this.parent.stack.delete(this.player);
      this.parent.stack.delete(this);
      delete this.parent.childs[this.name];
    }
  }

  set font(val) {
    this.setFont(val);
  }
  get font() {
    return this._font;
  }
  setFont(font) {
    if (font instanceof Font) {
      this._font = font;
      return;
    }
    if (!this.screen.fonts) this.screen.fonts = new Map();
    if (this.screen.fonts.has(font)) this._font = this.screen.fonts.get(font);
    else {
      this._font = new Font(font);
      this.screen.fonts.set(font, this._font);
    }
    return this;
  }

  set text(val) {
    this.setText(val);
  }
  get text() {
    return this._text;
  }
  setText(text) {
    this._text = text;
    this._font.write(this.ctx, this._text, this.color, this.bgColor);
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    return this;
  }

  set mode(val) {
    this.setMode(val);
  }
  get mode() {
    return this._mode;
  }
  setMode(mode = this._mode) {
    mode = mode.toLowerCase();
    if (asepriteModes[mode]) mode = asepriteModes[mode];
    if (Layer.blendModes.includes(mode)) this._mode = mode;
    else console.warn(`${mode} is not a valid composite operation`);
    return this;
  }

  set opacity(val) {
    this.setOpacity(val);
  }
  get opacity() {
    return Number(this._opacity);
  }
  setOpacity(opacity = this._opacity) {
    this._opacity = String(opacity);
    this.visible = opacity > 0;
    return this;
  }

  setX(x = this.x) {
    this.x = x;
    return this;
  }

  setY(y = this.y) {
    this.y = y;
    return this;
  }

  pos(x = this.x, y = this.y) {
    this.x = x;
    this.y = y;
    return this;
  }

  my(myX, myY) {
    this.myX = myX;
    this.myY = myY;
    return this;
  }

  at(atX, atY) {
    this.atX = atX;
    this.atY = atY;
    return this;
  }

  center() {
    this.myX = 0.5;
    this.atX = 0.5;
    this.myY = 0.5;
    this.atY = 0.5;
    return this;
  }
}

const asepriteModes = {
  normal: "source-over",
  "color dodge": "color-dodge",
  "color burn": "color-burn",
  "hard light": "hard-light",
  "soft light": "soft-light",
};

Layer.blendModes = [
  "source-over",
  "source-in",
  "source-out",
  "source-atop",
  "destination-over",
  "destination-in",
  "destination-out",
  "destination-atop",
  "lighter",
  "copy",
  "xor",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

const outlineType = {
  // prettier-ignore
  cross: [
     1,  0,
     0,  1,
    -1,  0,
     0, -1,
  ],
  // prettier-ignore
  square: [
     1,  0,
     0,  1,
    -1,  0,
     0, -1,
    -1, -1,
     1,  1,
    -1,  1,
     1, -1,
  ],
};

Layer.fx = {
  fill({ ctx }, fill) {
    ctx.save();
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  },

  colorize(screen, [color, opacity = 0.5]) {
    const { ctx } = screen;
    const a = screen.clone();
    a.ctx.globalCompositeOperation = "source-in";
    a.ctx.globalAlpha = opacity;
    a.ctx.fillStyle = color;
    a.ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.drawImage(a.canvas, 0, 0);
    ctx.restore();
    Visual.pool.recycle(a);
  },

  mirrorX(screen) {
    const { ctx } = screen;
    const a = screen.clone();
    screen.clear();
    ctx.save();
    ctx.translate(ctx.canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(a.canvas, 0, 0);
    ctx.restore();
    Visual.pool.recycle(a);
  },

  mirrorY(screen) {
    const { ctx } = screen;
    const a = screen.clone();
    screen.clear();
    ctx.save();
    ctx.translate(0, ctx.canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(a.canvas, 0, 0);
    ctx.restore();
    Visual.pool.recycle(a);
  },

  shadow(screen, data) {
    const { ctx } = screen;
    const a = screen.clone();
    const b = screen.clone();
    screen.clear();
    b.reset();
    data.forEach(([x, y, color]) => {
      b.clear();
      b.ctx.drawImage(a.canvas, x, y);
      b.ctx.globalCompositeOperation = "source-in";
      b.ctx.fillStyle = color;
      b.ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      b.ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(b.canvas, 0, 0);
    });
    ctx.drawImage(a.canvas, 0, 0);
    Visual.pool.recycle(a);
    Visual.pool.recycle(b);
  },

  light(screen, data) {
    const { ctx } = screen;
    const a = screen.clone();
    const b = Visual.pool.get();
    const c = Visual.pool.get();
    b.reset();
    c.reset();
    data.forEach(([x, y, color]) => {
      b.reset();
      b.ctx.drawImage(a.canvas, x, y);
      c.ctx.drawImage(a.canvas, 0, 0);
      c.ctx.globalCompositeOperation = "destination-out";
      c.ctx.drawImage(b.canvas, 0, 0);
      c.ctx.globalCompositeOperation = "source-over";
      b.clear();
      b.ctx.drawImage(c.canvas, 0, 0);
      b.ctx.globalCompositeOperation = "source-in";
      b.ctx.fillStyle = color;
      b.ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      a.ctx.drawImage(b.canvas, 0, 0);
    });
    ctx.drawImage(a.canvas, 0, 0);
    Visual.pool.recycle(a);
    Visual.pool.recycle(b);
  },

  border(screen, colors) {
    const { ctx } = screen;
    const a = screen.clone();
    const arr = outlineType.cross;
    colors.forEach(color => {
      for (let i = 0, l = arr.length; i < l; i++) {
        ctx.drawImage(a.canvas, arr[i], arr[++i]);
      }
      ctx.save();
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      ctx.drawImage(a.canvas, 0, 0);
      a.ctx.drawImage(ctx.canvas, 0, 0);
    });
    Visual.pool.recycle(a);
  },

  outline(screen, colors) {
    const { ctx } = screen;
    const a = screen.clone();
    const arr = outlineType.square;
    colors.forEach(color => {
      for (let i = 0, l = arr.length; i < l; i++) {
        ctx.drawImage(a.canvas, arr[i], arr[++i]);
      }
      ctx.save();
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      ctx.drawImage(a.canvas, 0, 0);
      a.ctx.drawImage(ctx.canvas, 0, 0);
    });
    Visual.pool.recycle(a);
  },

  stroke(screen, colors) {
    const { ctx, canvas } = screen;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    for (let i = 0, l = data.length; i < l; i += 4) {
      if (data[i + 3] > 0 && data[i + 3] < 255) data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const a = screen.clone();
    const b = screen.clone();
    const arr = outlineType.square;
    colors.forEach(color => {
      for (let i = 0, l = arr.length; i < l; i++) {
        ctx.drawImage(a.canvas, arr[i], arr[++i]);
      }
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      a.ctx.drawImage(ctx.canvas, 0, 0);
    });

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(b.canvas, 0, 0);
    ctx.restore();
  },
};
