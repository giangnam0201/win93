export const emittable = (el = {}, events = {}) => {
  const methods = {
    on(event, fn) {
      if (typeof fn === "function") {
        (events[event] = events[event] || []).push(fn);
      }
      return this;
    },

    off(event, fn) {
      if (event === "*" && !fn) events = {};
      else if (fn && events[event]) {
        events[event] = events[event].filter(cb => cb !== fn && cb.fn !== fn);
      } else delete events[event];
      return this;
    },

    once(event, fn) {
      const on = (...args) => {
        this.off(event, on);
        fn(...args);
      };
      on.fn = fn;
      return this.on(event, on);
    },

    emit(event, ...args) {
      const fns = [...(events[event] || [])];

      fns.forEach(fn => fn(...args));

      if (events["*"] && event !== "*") {
        this.emit(...["*", event], ...args);
      }

      return this;
    },
  };

  Object.entries(methods).forEach(([key, value]) => {
    if (key in el === false) {
      Object.defineProperty(el, key, {
        value,
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }
  });
};

export default class Emitter {
  constructor() {
    emittable(this);
  }

  static make(obj) {
    emittable(obj);
  }
}
