// Mirror build 4d6882a45b09f06da0cd1196b3a6e14a7572ec4d
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __glob = (map) => (path) => {
    var fn = map[path];
    if (fn) return fn();
    throw new Error("Module not found in bundle: " + path);
  };
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // 42/lib/class/error/AbortError.js
  var AbortError;
  var init_AbortError = __esm({
    "42/lib/class/error/AbortError.js"() {
      AbortError = class extends Error {
        constructor(message) {
          super(message);
          Object.defineProperties(this, {
            name: { value: "AbortError" },
            code: { value: DOMException.ABORT_ERR }
          });
        }
      };
    }
  });

  // 42/lib/class/Canceller.js
  var Canceller;
  var init_Canceller = __esm({
    "42/lib/class/Canceller.js"() {
      init_AbortError();
      Canceller = class _Canceller {
        /** @type {Canceller | undefined} */
        parent;
        /** @param {AbortSignal} [signal] */
        constructor(signal) {
          const controller = new AbortController();
          this.signal = controller.signal;
          this.cancel = (reason) => {
            if (typeof reason === "string") reason = new AbortError(reason);
            controller.abort(reason);
          };
          if (signal) this.addSignal(signal);
        }
        addSignal(signal) {
          signal.addEventListener("abort", () => this.cancel(signal.reason), {
            signal: this.signal
          });
        }
        fork() {
          if (this.signal.aborted) {
            throw new Error("Impossible to fork a Canceller with aborted signal");
          }
          const fork = new _Canceller(this.signal);
          fork.parent = this;
          return fork;
        }
      };
    }
  });

  // 42/lib/class/mixin/Emittable.js
  function Emittable(Base) {
    Base ??= Object;
    return class Emitter extends Base {
      static EVENTS = EVENTS;
      [EVENTS] = {};
      /**
       * Add an handler for a given event or a list of events.
       *
       * @overload
       * @param {string | string[]} events
       * @param {Function} fn
       * @returns {this}
       */
      /**
       * @overload
       * @param {string | string[]} events
       * @param {{ off: true; signal?: AbortSignal }} options
       * @param {Function} fn
       * @returns {() => this}
       */
      /**
       * @overload
       * @param {string | string[]} events
       * @param {{ off?: boolean; signal?: AbortSignal }} options
       * @param {Function} fn
       * @returns {this}
       */
      /**
       * @param {string | string[]} events
       * @param {Function | { off?: boolean; signal?: AbortSignal }} options
       * @param {Function} [fn]
       * @returns {this | (() => this)}
       */
      on(events, options, fn) {
        if (typeof options === "function") {
          fn = options;
          options = /** @type {unknown} */
          void 0;
        } else if (typeof fn !== "function") {
          throw new TypeError("`fn` argument is not an function");
        }
        events = arrifyEvents(events);
        for (const event of events) {
          this[EVENTS][event] ??= [];
          this[EVENTS][event].push(fn);
        }
        options?.signal?.addEventListener("abort", () => this.off(events, fn));
        return options?.off ? () => this.off(events, fn) : this;
      }
      /**
       * Add a one-time handler for a given event.
       * If no handler function is provided returns a Promise that resolves once the event is emitted.
       *
       * @overload
       * @param {string} event
       * @returns {Promise<any>}
       */
      /**
       * @overload
       * @param {string} event
       * @param {Function} fn
       * @returns {this}
       */
      /**
       * @param {string} event
       * @param {Function} [fn]
       */
      once(event, fn) {
        if (fn === void 0) {
          return new Promise((resolve) => {
            const on2 = (...args) => {
              this.off(event, on2);
              resolve(args.length > 1 ? args : args[0]);
            };
            this.on(event, on2);
          });
        }
        const on = (...args) => {
          this.off(event, on);
          return fn(...args);
        };
        on.originalFn = fn;
        this.on(event, on);
        return this;
      }
      /**
       * Remove the handlers of a given event or a list of events.
       *
       * @param {string | string[]} events
       * @param {Function} [fn]
       */
      off(events, fn) {
        if (!this[EVENTS]) return this;
        for (const event of arrifyEvents(events)) {
          if (event === "*" && !fn) {
            for (const key in this[EVENTS]) delete this[EVENTS][key];
          } else if (fn && this[EVENTS][event]) {
            this[EVENTS][event] = this[EVENTS][event].filter(
              (cb) => cb !== fn && cb.originalFn !== fn
            );
            if (this[EVENTS][event].length === 0) delete this[EVENTS][event];
          } else delete this[EVENTS][event];
        }
        return this;
      }
      /**
       * Calls each of the registered handlers for a given event or a list of events.
       *
       * @param {string | string[]} events
       * @param {...any} args
       */
      emit(events, ...args) {
        for (const event of arrifyEvents(events)) {
          if (this[EVENTS][event]) {
            for (const fn of this[EVENTS][event]) fn(...args);
          }
          if (this[EVENTS]["*"]) {
            for (const fn of this[EVENTS]["*"]) fn(event, ...args);
          }
        }
        return this;
      }
      /**
       * Call the last registered handler of a given event and returns it's results.
       *
       * @param {string} event
       * @param {...any} args
       */
      ask(event, ...args) {
        const fn = this[EVENTS][event]?.at(-1);
        if (fn) return fn(...args);
      }
      /**
       * Calls each of the registered handlers for a given event or a list of events.
       * Returns a promise that resolves when all results are fulfilled.
       *
       * @param {string | string[]} events
       * @param {...any} args
       */
      async all(events, ...args) {
        const list = [];
        for (const event of arrifyEvents(events)) {
          if (this[EVENTS][event]) {
            for (const fn of this[EVENTS][event]) list.push(fn(...args));
          }
          if (this[EVENTS]["*"]) {
            for (const fn of this[EVENTS]["*"]) list.push(fn(event, ...args));
          }
        }
        return Promise.all(list);
      }
    };
  }
  var SPLIT_REGEX, EVENTS, arrifyEvents;
  var init_Emittable = __esm({
    "42/lib/class/mixin/Emittable.js"() {
      SPLIT_REGEX = /\s*\|\|\s*/;
      EVENTS = /* @__PURE__ */ Symbol.for("Emitter.EVENTS");
      arrifyEvents = (events) => Array.isArray(events) ? events : events.split(SPLIT_REGEX);
      Emittable.EVENTS = EVENTS;
    }
  });

  // 42/lib/class/Emitter.js
  var Emitter;
  var init_Emitter = __esm({
    "42/lib/class/Emitter.js"() {
      init_Emittable();
      Emitter = Emittable();
    }
  });

  // 42/lib/class/error/SecurityError.js
  var SecurityError;
  var init_SecurityError = __esm({
    "42/lib/class/error/SecurityError.js"() {
      SecurityError = class extends Error {
        constructor(message) {
          super(message);
          Object.defineProperties(this, {
            name: { value: "SecurityError" },
            code: { value: DOMException.SECURITY_ERR }
          });
        }
      };
    }
  });

  // 42/lib/type/any/getTypeOf.js
  function getTypeOf(val) {
    if (val === null) return "null";
    const type = typeof val;
    if (type !== "object" && type !== "function") return type;
    return val.constructor?.name || "Object";
  }
  var init_getTypeOf = __esm({
    "42/lib/type/any/getTypeOf.js"() {
    }
  });

  // 42/lib/type/any/isInstanceOf.js
  function isInstanceOf(val, Class) {
    if (val instanceof Class) return true;
    if (val?.window) {
      if (val.location && val.window === val.self && typeof val.postMessage === "function") {
        return Class === globalThis.Window;
      }
    }
    let ctor = val?.constructor;
    while (ctor) {
      if (ctor.name === Class.name) return true;
      ctor = Object.getPrototypeOf(ctor);
    }
    return false;
  }
  var init_isInstanceOf = __esm({
    "42/lib/type/any/isInstanceOf.js"() {
    }
  });

  // 42/lib/class/error/TimeoutError.js
  var TimeoutError;
  var init_TimeoutError = __esm({
    "42/lib/class/error/TimeoutError.js"() {
      TimeoutError = class extends Error {
        constructor(message) {
          super(typeof message === "number" ? `Timed out: ${message}ms` : message);
          Object.defineProperties(this, {
            name: { value: "TimeoutError" },
            code: { value: DOMException.TIMEOUT_ERR }
          });
        }
      };
    }
  });

  // 42/lib/type/promise/defer.js
  function defer(options) {
    return new Deferred(options);
  }
  var Deferred;
  var init_defer = __esm({
    "42/lib/type/promise/defer.js"() {
      init_TimeoutError();
      Deferred = class extends Promise {
        static get [Symbol.species]() {
          return Promise;
        }
        get [Symbol.toStringTag]() {
          return "Deferred";
        }
        constructor(options) {
          let resolve;
          let reject;
          super((superResolve, superReject) => {
            resolve = (arg) => {
              this.isPending = false;
              this.isResolved = true;
              superResolve(arg);
            };
            reject = (err) => {
              this.isPending = false;
              this.isRejected = true;
              superReject(err);
            };
            const timeout = options?.timeout;
            if (timeout) {
              let err = typeof options?.timeoutError === "string" ? new TimeoutError(options?.timeoutError) : options?.timeoutError ?? new TimeoutError(timeout);
              setTimeout(() => {
                if (this.isPending) superReject(err);
                err = void 0;
              }, timeout);
            }
          });
          this.resolve = resolve;
          this.reject = reject;
          this.isPending = true;
          this.isRejected = false;
          this.isResolved = false;
        }
      };
    }
  });

  // 42/api/env/realm.js
  var windowExist, selfExist, stringCache, Realm, realm;
  var init_realm = __esm({
    "42/api/env/realm.js"() {
      windowExist = globalThis.window !== void 0;
      selfExist = globalThis.self !== void 0;
      Realm = class {
        constructor() {
          this.inWindow = windowExist && window === window.self;
          this.inChildWindow = windowExist && globalThis.opener !== null;
          this.inTop = windowExist && window === window.top;
          this.inIframe = windowExist && window !== window.top;
          this.inOpaqueOrigin = globalThis.origin === "null";
          this.inSandbox = this.inIframe && this.inOpaqueOrigin;
          this.inWorker = selfExist && globalThis.WorkerGlobalScope !== void 0 && self instanceof WorkerGlobalScope;
          this.inSharedWorker = selfExist && globalThis.SharedWorkerGlobalScope !== void 0 && self instanceof SharedWorkerGlobalScope;
          this.inServiceWorker = selfExist && globalThis.ServiceWorkerGlobalScope !== void 0 && self instanceof ServiceWorkerGlobalScope;
          this.inDedicatedWorker = selfExist && globalThis.DedicatedWorkerGlobalScope !== void 0 && self instanceof DedicatedWorkerGlobalScope;
          this.inWorklet = globalThis.WorkletGlobalScope !== void 0 && globalThis instanceof globalThis.WorkletGlobalScope;
          this.inAudioWorklet = globalThis.AudioWorkletGlobalScope !== void 0 && globalThis instanceof globalThis.AudioWorkletGlobalScope;
          this.inPaintWorklet = globalThis.PaintWorkletGlobalScope !== void 0 && globalThis instanceof globalThis.PaintWorkletGlobalScope;
        }
        toString() {
          if (stringCache) return stringCache;
          if (this.inWindow) {
            if (this.inTop) stringCache = "top";
            else if (this.inSandbox) stringCache = "sandbox";
            else if (this.inIframe) stringCache = "iframe";
            else if (this.inChildWindow) stringCache = "childWindow";
          } else if (this.inWorker) {
            if (this.inDedicatedWorker) stringCache = "worker";
            else if (this.inSharedWorker) stringCache = "sharedWorker";
            else if (this.inServiceWorker) stringCache = "serviceWorker";
          } else if (this.inAudioWorklet) stringCache = "audioWorklet";
          else if (this.inPaintWorklet) stringCache = "paintWorklet";
          return stringCache;
        }
        [Symbol.toPrimitive]() {
          return this.toString();
        }
      };
      realm = new Realm();
    }
  });

  // 42/lib/class/EntropyPool.js
  var EntropyPool;
  var init_EntropyPool = __esm({
    "42/lib/class/EntropyPool.js"() {
      EntropyPool = class {
        #entropy;
        #index;
        #size;
        constructor(size = 1024) {
          this.#entropy = new Uint32Array(size);
          this.#size = size;
          this.#index = 0;
          crypto.getRandomValues(this.#entropy);
          this.get = () => {
            const value = this.#entropy[this.#index++];
            if (this.#index === this.#size) {
              crypto.getRandomValues(this.#entropy);
              this.#index = 0;
            }
            return value;
          };
        }
      };
    }
  });

  // 42/api/uid.js
  function uid(size = 10) {
    size = Math.max(8, Math.min(128, size));
    let id = String.fromCodePoint(97 + pool.get() % 26);
    size--;
    while (size--) {
      const byte = pool.get() & 61;
      id += byte < 36 ? byte.toString(36) : (byte - 26).toString(36).toUpperCase();
    }
    return id;
  }
  var pool;
  var init_uid = __esm({
    "42/api/uid.js"() {
      init_EntropyPool();
      pool = new EntropyPool();
    }
  });

  // 42/api/ipc.js
  function findIframe(source) {
    for (const el of document.querySelectorAll("iframe")) {
      if (el.contentWindow === source) return el;
    }
  }
  async function handleMessage(data, source) {
    switch (data.type) {
      // case HANDSHAKE:
      //   console.log("HANDSHAKE", String(realm), data)
      //   break
      case EMIT: {
        const { events, args } = data;
        ipc.local.emit(events, ...args);
        sources.get(source)?.local.emit(events, ...args);
        break;
      }
      case ASK: {
        const { event, id, args } = data;
        const bus = sources.get(source);
        const res = await (bus ? bus.local.ask(event, ...args) : ipc.local.ask(event, ...args));
        source.postMessage({ type: REPLY, id, res });
        break;
      }
      case REPLY: {
        const { id, res } = data;
        if (askQueue[id]) askQueue[id].resolve(res);
        break;
      }
      default:
        break;
    }
  }
  var EMIT, ASK, REPLY, _EVENTS, askQueue, targetOrigin, sources, globalContext, Sender, Bus, IPC, ipc;
  var init_ipc = __esm({
    "42/api/ipc.js"() {
      init_Canceller();
      init_Emitter();
      init_SecurityError();
      init_getTypeOf();
      init_isInstanceOf();
      init_defer();
      init_realm();
      init_uid();
      EMIT = "42_IPC_EMIT";
      ASK = "42_IPC_ASK";
      REPLY = "42_IPC_REPLY";
      _EVENTS = /* @__PURE__ */ Symbol.for("Emitter.EVENTS");
      askQueue = {};
      ({ origin: targetOrigin } = new URL(self.location.href));
      sources = /* @__PURE__ */ new WeakMap();
      globalContext = { emit: void 0 };
      if (realm.inTop) {
        globalContext.emit = () => {
          console.log("emit from top");
        };
      } else if (realm.inIframe) {
        globalContext.emit = (message, options, targetOrigin2) => {
          window.parent.postMessage(message, {
            targetOrigin: targetOrigin2,
            ...options
          });
        };
      } else if (realm.inChildWindow) {
        globalContext.emit = (message, options, targetOrigin2) => {
          window.opener.postMessage(message, {
            targetOrigin: targetOrigin2,
            ...options
          });
        };
      } else if (realm.inDedicatedWorker) {
        globalContext.emit = (message, options) => self.postMessage(message, options);
      } else if (realm.inSharedWorker) {
        globalContext.emit = () => {
          console.log("emit from sharedWorker");
        };
      } else if (realm.inServiceWorker) {
        globalContext.emit = async (message, options) => {
          for (const client of await self.clients.matchAll({
            includeUncontrolled: true
          })) {
            client.postMessage(message, options);
          }
        };
      }
      Sender = class extends Emitter {
        targetOrigin = targetOrigin;
        constructor(context, options) {
          super({ signal: options?.signal });
          this.context = context;
          this.local = {
            emit: (events, ...args) => super.emit(events, ...args),
            ask: (events, ...args) => super.ask(events, ...args)
          };
        }
        /**
         * @param {string | string[]} events
         * @param {...any} args
         */
        emit(events, ...args) {
          this.context.emit(
            { type: EMIT, events, args },
            void 0,
            this.targetOrigin
          );
          return this;
        }
        /**
         * @param {string} event
         * @param {...any} args
         */
        async ask(event, ...args) {
          const id = uid();
          this.context.emit(
            { type: ASK, id, event, args },
            void 0,
            this.targetOrigin
          );
          const deferred = new Deferred();
          askQueue[id] = deferred;
          return deferred;
        }
      };
      Bus = class _Bus extends Sender {
        static register(source, options, sourcePostMessage) {
          sourcePostMessage ??= source;
          source.addEventListener(
            "message",
            ({ isTrusted, data }) => {
              if (!isTrusted || !data?.type) return;
              handleMessage(data, sourcePostMessage);
            },
            options
          );
          if (isInstanceOf(source, MessagePort)) source.start();
        }
        /** @param {Window} contentWindow */
        #addWindowSource(contentWindow) {
          this.source = contentWindow;
          if (!this.iframe && !contentWindow.opener) {
            this.iframe = findIframe(contentWindow);
          }
          let { targetOrigin: targetOrigin2 } = this;
          if (!targetOrigin2) {
            if (this.iframe) {
              const iframeOrigin = this.iframe.src ? new URL(this.iframe.src).origin : location.origin;
              targetOrigin2 = iframeOrigin === location.origin ? this.iframe.hasAttribute("sandbox") ? this.iframe.sandbox.contains("allow-same-origin") ? location.origin : "*" : location.origin : false;
              if (!targetOrigin2) {
                throw new SecurityError(
                  `Untrusted iframe origin: ${iframeOrigin}, you can allow it using the \`targetOrigin\` option`
                );
              }
            }
          }
          sources.set(this.source, this);
          this.context.emit = (message, options) => {
            if (this.signal.aborted) throw this.signal.reason;
            this.source.postMessage(message, {
              ...options,
              targetOrigin: targetOrigin2
            });
          };
        }
        constructor(source, options) {
          const { cancel, signal } = new Canceller(options?.signal);
          const context = {
            emit: (message, options2) => {
              if (signal.aborted) throw signal.reason;
              this.source.postMessage(message, options2);
            }
          };
          super(context, { signal });
          this.cancel = cancel;
          this.signal = signal;
          this.targetOrigin = typeof options === "string" ? options : options?.targetOrigin;
          if ("onmessage" in source) {
            if (globalThis.Window && isInstanceOf(source, Window)) {
              this.#addWindowSource(source);
            } else {
              this.source = source;
              sources.set(this.source, this);
              _Bus.register(this.source, { signal });
            }
          } else if ("port" in source) {
            this.source = source.port;
            sources.set(this.source, this);
            _Bus.register(this.source, { signal });
          } else if (globalThis.HTMLIFrameElement && source instanceof HTMLIFrameElement) {
            this.iframe = source;
            if (source.contentWindow) {
              this.#addWindowSource(source.contentWindow);
            } else {
              const queue = [];
              this.context.emit = (...args) => queue.push(args);
              source.addEventListener(
                "load",
                () => {
                  this.#addWindowSource(source.contentWindow);
                  for (const args of queue) this.context.emit(...args);
                  queue.length = 0;
                },
                { signal }
              );
            }
          } else if (isInstanceOf(source, ServiceWorker)) {
            this.source = source;
            sources.set(this.source, this);
            _Bus.register(navigator.serviceWorker, { signal }, source);
          } else {
            throw new TypeError(`\`source\` is not valid, got: ${getTypeOf(source)}`);
          }
        }
        async askOnce(event, data, options) {
          const res = await this.ask(event, data, options);
          this.destroy();
          return res;
        }
        destroy() {
          this.cancel(`Bus destroyed`);
          if (_EVENTS in this) {
            this.off("*");
            delete this[_EVENTS];
          }
          sources.delete(this.source);
          if (isInstanceOf(this.source, MessagePort)) this.source.close();
          this.source = void 0;
        }
      };
      IPC = class extends Sender {
        constructor() {
          if (globalContext.ipc) return globalContext.ipc;
          super(globalContext);
        }
        register(source, options) {
          const { cancel, signal } = new Canceller(options);
          Bus.register(source, { signal });
          return cancel;
        }
        bus(source, options) {
          return new Bus(source, options);
        }
      };
      ipc = new IPC();
      globalContext.ipc = ipc;
      globalThis.addEventListener("message", ({ isTrusted, data, source }) => {
        if (!isTrusted || !data?.type) return;
        handleMessage(data, source);
      });
    }
  });

  // 42/lib/type/string/capitalize.js
  var capitalize;
  var init_capitalize = __esm({
    "42/lib/type/string/capitalize.js"() {
      capitalize = (str, options) => options?.force ? str.charAt(0).toLocaleUpperCase() + str.slice(1).toLocaleLowerCase() : str.charAt(0).toLocaleUpperCase() + str.slice(1);
    }
  });

  // 42/lib/type/string/isCamelCase.js
  var CAMELCASE_REGEX, isCamelCase;
  var init_isCamelCase = __esm({
    "42/lib/type/string/isCamelCase.js"() {
      CAMELCASE_REGEX = /^[A-Za-z][\dA-Za-z]*$/;
      isCamelCase = (str) => CAMELCASE_REGEX.test(str);
    }
  });

  // 42/lib/type/string/isHyphenCase.js
  var HYPHEN_REGEX, isHyphenCase;
  var init_isHyphenCase = __esm({
    "42/lib/type/string/isHyphenCase.js"() {
      HYPHEN_REGEX = /^[a-z][\da-z-]*$/i;
      isHyphenCase = (str) => HYPHEN_REGEX.test(str);
    }
  });

  // 42/lib/type/string/isLodashCase.js
  var LODASH_REGEX, isLodashCase;
  var init_isLodashCase = __esm({
    "42/lib/type/string/isLodashCase.js"() {
      LODASH_REGEX = /^[a-z]\w*$/i;
      isLodashCase = (str) => LODASH_REGEX.test(str);
    }
  });

  // 42/lib/type/string/isUpperCase.js
  var isUpperCase;
  var init_isUpperCase = __esm({
    "42/lib/type/string/isUpperCase.js"() {
      isUpperCase = (str) => str === str.toUpperCase();
    }
  });

  // 42/lib/type/string/transform.js
  function parseWords(source, each = (x) => x) {
    let current = 0;
    let isUppercase = false;
    let buffer = "";
    const tokens = [];
    function flush() {
      tokens.push(each(buffer, tokens.length));
      buffer = "";
    }
    while (current < source.length) {
      const code2 = source.codePointAt(current);
      if (code2 > 64 && code2 < 91) {
        if (!isUppercase && buffer) flush();
        isUppercase = true;
        buffer += String.fromCodePoint(code2);
      } else if (code2 > 47 && code2 < 58 || code2 > 96 && code2 < 123) {
        isUppercase = false;
        buffer += String.fromCodePoint(code2);
      } else if (buffer) {
        flush();
      }
      current++;
    }
    if (buffer) tokens.push(each(buffer, tokens.length));
    return tokens;
  }
  function combineWords(each, joiner = "") {
    return (
      /** @param {string} str */
      ((str) => parseWords(str, each).join(joiner))
    );
  }
  function toCapitalCase(str) {
    if (!str) return "";
    if (isCamelCase(str)) str = fromCamelCase(str);
    else if (isLodashCase(str)) str = str.replaceAll("_", " ");
    else if (isHyphenCase(str)) str = str.replaceAll("-", " ");
    return str.replaceAll(
      WORDS_REGEX,
      (_) => isUpperCase(_) ? _ : capitalize(_)
    );
  }
  var fromCamelCase, toKebabCase, toHeaderCase, toConstantCase, toSnakeCase, toNoCase, WORDS_REGEX;
  var init_transform = __esm({
    "42/lib/type/string/transform.js"() {
      init_capitalize();
      init_isCamelCase();
      init_isHyphenCase();
      init_isLodashCase();
      init_isUpperCase();
      fromCamelCase = (str) => str.replaceAll(/([\da-z])([A-Z])/g, "$1 $2").replaceAll(/([A-Z]+)([A-Z][\da-z]+)/g, "$1 $2");
      toKebabCase = combineWords((str) => str.toLowerCase(), "-");
      toHeaderCase = combineWords(
        (str) => str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase(),
        "-"
      );
      toConstantCase = combineWords((str) => str.toUpperCase(), "_");
      toSnakeCase = combineWords((x) => x.toLowerCase(), "_");
      toNoCase = combineWords((x) => x.toLowerCase(), " ");
      WORDS_REGEX = /[A-Z]?[a-z]+\d*|[\dA-Za-z]+/g;
    }
  });

  // 42/api/db/DatabaseError.js
  function getCauseMessage(cause) {
    return `Database error (${cause.message || capitalize(toCapitalCase(cause.name).toLowerCase())})`;
  }
  var DatabaseError;
  var init_DatabaseError = __esm({
    "42/api/db/DatabaseError.js"() {
      init_capitalize();
      init_transform();
      DatabaseError = class extends Error {
        constructor(cause, details) {
          if (typeof cause === "string") {
            super(cause);
            Object.defineProperty(this, "name", {
              configurable: true,
              value: "DatabaseError"
            });
          } else {
            super(getCauseMessage(cause));
            Object.defineProperty(this, "name", {
              configurable: true,
              value: cause.name === "Error" ? "DatabaseError" : cause.name
            });
            this.cause = cause;
          }
          if (details) this.details = details;
        }
        causedBy(cause, details) {
          if (!cause) return this;
          this.cause = cause;
          const oldStackTitle = `${this.name}: ${this.message}`;
          Object.defineProperty(this, "name", {
            configurable: true,
            value: cause.name === "Error" ? "DatabaseError" : cause.name
          });
          this.message = getCauseMessage(cause);
          const newStackTitle = `${this.name}: ${this.message}`;
          if (!this.stack.startsWith(newStackTitle)) {
            Object.defineProperty(this, "stack", {
              configurable: true,
              enumerable: true,
              writable: true,
              value: this.stack.replace(oldStackTitle, newStackTitle)
            });
          }
          if (details) this.details = details;
          return this;
        }
      };
    }
  });

  // 42/lib/type/any/isHashmapLike.js
  function isHashmapLike(val) {
    return val !== null && typeof val === "object" && (val.constructor?.name === "Object" || Object.getPrototypeOf(val) === null);
  }
  var init_isHashmapLike = __esm({
    "42/lib/type/any/isHashmapLike.js"() {
    }
  });

  // 42/lib/type/object/merge.js
  function mergeWalk(target, source, seen = /* @__PURE__ */ new WeakMap()) {
    for (const [key, val] of Object.entries(source)) {
      if (seen.has(val)) {
        target[key] = seen.get(val);
      } else if (Array.isArray(val)) {
        target[key] = [];
        seen.set(val, target[key]);
        mergeWalk(target[key], val, seen);
      } else if (isHashmapLike(val)) {
        if (target[key] == null || typeof target[key] !== "object") {
          target[key] = {};
        }
        seen.set(val, target[key]);
        mergeWalk(target[key], val, seen);
      } else {
        target[key] = val;
      }
    }
    return target;
  }
  function mergeWalkCallback(target, source, cb, seen = /* @__PURE__ */ new WeakMap()) {
    for (const [key, val] of Object.entries(source)) {
      if (cb({ key, val, target, source, seen }) === true) continue;
      if (seen.has(val)) {
        target[key] = seen.get(val);
      } else if (Array.isArray(val)) {
        target[key] = [];
        seen.set(val, target[key]);
        mergeWalkCallback(target[key], val, cb, seen);
      } else if (isHashmapLike(val)) {
        if (target[key] == null || typeof target[key] !== "object") {
          target[key] = {};
        }
        seen.set(val, target[key]);
        mergeWalkCallback(target[key], val, cb, seen);
      } else {
        target[key] = val;
      }
    }
    return target;
  }
  function merge(target, source, callback) {
    return callback ? mergeWalkCallback(target, source, callback) : mergeWalk(target, source);
  }
  var init_merge = __esm({
    "42/lib/type/object/merge.js"() {
      init_isHashmapLike();
    }
  });

  // 42/api/db/ObjectStore.js
  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onerror = (e) => {
        e.stopPropagation();
        reject(new DatabaseError(e.target.error));
      };
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        resolve(cursor);
      };
      req.transaction.oncomplete = () => {
        resolve();
      };
    });
  }
  function predicateObject(object) {
    const entries = Object.entries(object);
    return (value) => {
      if (typeof value !== "object") {
        throw new TypeError("Predicate object only work with object values");
      }
      let ok = true;
      for (const [key, test] of entries) {
        if (key in value) {
          if (test instanceof RegExp) {
            if (test.test(value[key]) === false) ok = false;
            test.lastIndex = 0;
          } else if (Object.is(value[key], test) === false) {
            ok = false;
          }
        } else ok = false;
      }
      return ok;
    };
  }
  var DEFAULT_ITERATE, WRITE_ACTIONS, ObjectStore;
  var init_ObjectStore = __esm({
    "42/api/db/ObjectStore.js"() {
      init_DatabaseError();
      init_merge();
      init_AbortError();
      DEFAULT_ITERATE = {
        value: true,
        key: true,
        one: false,
        mode: "readonly",
        method: "openCursor",
        query: void 0,
        direction: void 0,
        durability: "default"
      };
      WRITE_ACTIONS = /* @__PURE__ */ new Set(["put", "add", "clear", "delete"]);
      ObjectStore = class _ObjectStore {
        #index;
        #signal;
        constructor(db3, name, index, signal) {
          this.db = db3;
          this.name = name;
          this.#index = index;
          this.#signal = signal;
          this.range = IDBKeyRange;
          this.count = (key) => this.tx("readonly", "count", key);
          this.get = (key) => this.tx("readonly", "get", key);
          this.key = (key) => this.tx("readonly", "getKey", key);
          this.find = (predicate) => this.iterate({ one: true, key: false }, predicate);
          this.findKey = (predicate) => this.iterate({ one: true, key: true, value: false }, predicate);
          this.add = (...args) => this.tx("readwrite", "add", ...args);
          this.put = (...args) => this.tx("readwrite", "put", ...args);
          this.clear = () => this.tx("readwrite", "clear");
          this.delete = (key) => this.tx("readwrite", "delete", key);
          this.set = (key, value) => this.put(value, key);
          this.getAllKeys = (...args) => this.tx("readonly", "getAllKeys", ...args);
          this.getAll = (...args) => this.tx("readonly", "getAll", ...args);
          this.keys = (options) => this.iterate({ ...options, value: false }, () => true);
          this.values = (options) => this.iterate({ ...options, key: false }, () => true);
          this.entries = (options) => this.iterate(options, () => true);
          this.filter = (options, predicate) => predicate === void 0 ? this.iterate({ key: false }, options) : this.iterate({ ...options, key: false }, predicate);
          this.filterKeys = (options, predicate) => predicate === void 0 ? this.iterate({ key: true, value: false }, options) : this.iterate({ ...options, key: true, value: false }, predicate);
        }
        index(index) {
          return new _ObjectStore(this.db, this.name, index);
        }
        signal(signal) {
          return new _ObjectStore(this.db, this.name, this.#index, signal);
        }
        async update(key, value) {
          const req = await this.tx("readwrite");
          const cursor = await wrap(req.openCursor(key));
          if (cursor === null) throw new RangeError(`No cursor found for ${key}`);
          cursor.update(merge(cursor.value, value));
          await new Promise((resolve) => {
            req.transaction.oncomplete = () => resolve();
          });
          return cursor.key;
        }
        async has(key) {
          const cursor = await this.tx("readonly", "openKeyCursor", key);
          return Boolean(cursor);
        }
        async fromEntries(entries) {
          await this.tx("readwrite", ({ store }) => {
            for (const [key, value] of entries) store.put(value, key);
          });
        }
        async from(arr) {
          await this.tx("readwrite", ({ store }) => {
            for (const value of arr) store.put(value);
          });
        }
        async tx(mode, action, ...args) {
          if (this.#signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const db3 = await this.db.init();
          const dbError = new DatabaseError("Unknown database error");
          const abortError = new AbortError("Aborted database transaction");
          return new Promise((resolve, reject) => {
            const tx = db3.transaction(this.name, mode, {
              durability: this.db.durability
            });
            const onabort = () => {
              if (typeof this.#signal?.reason === "string" && this.#signal.reason) {
                abortError.message = this.#signal?.reason;
              }
              tx.abort();
            };
            this.#signal?.addEventListener("abort", onabort);
            const end = (e) => {
              e?.stopPropagation();
              this.#signal?.removeEventListener("abort", onabort);
            };
            tx.onerror = (e) => {
              end(e);
              reject(dbError.causedBy(tx.error, { mode, action, args }));
            };
            tx.onabort = (e) => {
              end(e);
              if (tx.error) {
                reject(dbError.causedBy(tx.error, { mode, action, args }));
              } else {
                reject(abortError);
              }
            };
            let store = tx.objectStore(this.name);
            if (this.#index !== void 0) store = store.index(this.#index);
            if (typeof action === "function") {
              tx.oncomplete = () => {
                end();
                resolve();
              };
              action({ store, resolve, reject });
            } else if (action) {
              const req = store[action](...args);
              req.onerror = (e) => {
                end(e);
                reject(new DatabaseError(req.error));
              };
              tx.oncomplete = () => {
                end();
                resolve(req.result);
              };
              if (WRITE_ACTIONS.has(action)) tx.commit?.();
            } else {
              tx.onerror = null;
              tx.onabort = null;
              resolve(store);
            }
          });
        }
        /**
         * @param {{ one?: boolean; key?: boolean; value?: boolean; }} options
         * @param {Function} [predicate]
         * @returns {{
         *   [Symbol.asyncIterator](): AsyncGenerator;
         *   items(): Promise<any>;
         *   then(resolve: any, reject: any): Promise<any>;
         * }}
         */
        iterate(options, predicate) {
          if (typeof options === "function") {
            predicate = options;
            options = {};
          }
          const config = { ...DEFAULT_ITERATE, ...options };
          if (typeof predicate === "object") predicate = predicateObject(predicate);
          const makeReq = (config2, query) => this.tx(config2.mode).then(
            (store) => store[config2.method](query || config2.query, config2.direction)
          );
          const txPromise = makeReq(config).then((req) => {
            const append = config.key === true && config.value === false ? (cursor) => cursor.key : config.key === false ? (cursor) => cursor.value : (cursor) => [cursor.key, cursor.value];
            return [req, append];
          });
          const out = {};
          out[Symbol.asyncIterator] = async function* () {
            let [req, append] = await txPromise;
            let cursor = await wrap(req);
            while (cursor) {
              const res = predicate(cursor.value, cursor);
              if (res === true) {
                yield append(cursor);
                if (config.one) return;
              }
              try {
                cursor.continue();
              } catch (err) {
                if (err.name === "TransactionInactiveError" && config.query === void 0) {
                  const query = IDBKeyRange[cursor.direction === "prev" || cursor.direction === "prevunique" ? "upperBound" : "lowerBound"](cursor.key, true);
                  req = await makeReq(config, query);
                  cursor = await wrap(req);
                  continue;
                } else throw err;
              }
              cursor = await wrap(req);
            }
          };
          out.items = async () => {
            const [req, append] = await txPromise;
            return new Promise((resolve, reject) => {
              const items = [];
              req.onerror = (e) => {
                e.stopPropagation();
                reject(new DatabaseError(e.target.error));
              };
              req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                  let res;
                  try {
                    res = predicate(cursor.value, cursor);
                  } catch (err) {
                    reject(err);
                    return;
                  }
                  if (res === true) {
                    items.push(append(cursor));
                    if (config.one) return;
                  }
                  cursor.continue();
                }
              };
              req.transaction.oncomplete = config.one ? () => resolve(items[0]) : () => resolve(items);
            });
          };
          out.then = (resolve, reject) => out.items().then(resolve, reject);
          return out;
        }
      };
    }
  });

  // 42/api/configure.js
  function configure(...optionsList) {
    const config = {};
    if (optionsList.length === 0) return config;
    const seen = /* @__PURE__ */ new WeakMap();
    for (const options of optionsList) {
      if (isHashmapLike(options)) {
        seen.set(options, config);
        mergeWalk(config, options, seen);
      } else if (!(options == null || typeof options === "boolean")) {
        throw new TypeError(
          `Arguments must be objects, boolean or nullish: ${typeof options}`
        );
      }
    }
    return config;
  }
  var init_configure = __esm({
    "42/api/configure.js"() {
      init_isHashmapLike();
      init_merge();
      configure.preset = (presets, ...optionsList) => configure(
        ...optionsList.map((options) => {
          if (typeof options === "string") {
            if (options in presets) return presets[options];
            throw new TypeError(`Unknown preset: ${options}`);
          } else if (isHashmapLike(options) && "preset" in options) {
            const { preset, ...rest } = options;
            if (Array.isArray(preset)) {
              return configure(...preset.map((p2) => presets[p2]), rest);
            }
            return configure(presets[preset], rest);
          }
          return options;
        })
      );
    }
  });

  // 42/api/db/Database.js
  var DEFAULTS, debug, Database;
  var init_Database = __esm({
    "42/api/db/Database.js"() {
      init_DatabaseError();
      init_ObjectStore();
      init_configure();
      init_defer();
      DEFAULTS = {
        name: "database",
        version: 1,
        stores: {},
        durability: "default",
        persistent: true,
        retries: 10,
        /** @type {Function} */
        populate: void 0,
        /** @type {Function} */
        downgrade: void 0,
        /** @type {Function} */
        upgrade: void 0
      };
      debug = 0;
      Database = class _Database {
        #config;
        #obsolete = false;
        /** @type {ObjectStore} */
        store;
        static async list() {
          return indexedDB.databases();
        }
        static async open(name, version, options) {
          return new Promise((resolve, reject) => {
            const req = indexedDB.open(name, version);
            if (options?.blocked) req.onblocked = options?.blocked;
            let pending;
            req.onupgradeneeded = ({ oldVersion, newVersion }) => {
              if (debug) console.log("db onupgradeneeded", name);
              if (options?.upgrade) {
                pending = options.upgrade(req.result, {
                  oldVersion,
                  newVersion,
                  transaction: req.transaction
                }).catch(reject);
              }
            };
            req.onerror = async () => {
              if (options?.downgrade && req.error.name === "VersionError") {
                try {
                  const db3 = await _Database.open(name);
                  await options.downgrade(db3, {
                    oldVersion: db3.version,
                    newVersion: version,
                    transaction: req.transaction
                  });
                  resolve(await _Database.open(name, version));
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new DatabaseError(req.error));
              }
            };
            req.onsuccess = async () => {
              if (pending) await pending;
              resolve(req.result);
            };
          });
        }
        static async delete(name, options) {
          return new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(name);
            if (options?.blocked) req.onblocked = options.blocked;
            req.onsuccess = //
            () => resolve();
            req.onerror = //
            () => reject(new DatabaseError(`Couldn't delete database ${name}`));
          });
        }
        /**
         * @overload
         * @param {string} name
         * @param {DatabaseOptions} [options]
         */
        /**
         * @overload
         * @param {DatabaseOptions} options
         */
        /**
         * @param {string | DatabaseOptions} name
         * @param {DatabaseOptions} [options]
         */
        constructor(name, options = {}) {
          if (typeof name === "string") options.name = name;
          else options = name ?? {};
          if ("stores" in options === false) options.stores = { store: {} };
          this.#config = configure(DEFAULTS, options);
          this.ready = defer();
          this.indexedDB = void 0;
          this.name = this.#config.name;
          this.durability = this.#config.durability;
          this.range = IDBKeyRange;
          this.stores = {};
          Object.keys(this.#config.stores).forEach(
            (name2) => this.#registerStore(name2)
          );
        }
        #registerStore(name) {
          const descriptor = { get: () => new ObjectStore(this, name) };
          if (this[name] === void 0) Object.defineProperty(this, name, descriptor);
          Object.defineProperty(this.stores, name, descriptor);
        }
        #registerDB(db3) {
          db3.addEventListener("close", () => {
            if (debug) console.log("db close");
            this.indexedDB = void 0;
          });
          db3.addEventListener("versionchange", () => {
            if (debug) console.log("db versionchange");
            db3.close();
            this.#obsolete = true;
            this.indexedDB = void 0;
          });
          return db3;
        }
        async #downgrade(db3, arg) {
          if (this.#config.downgrade) {
            const res = await this.#config.downgrade(this, db3, arg);
            if (res === false) return;
          }
          db3.close();
          await _Database.delete(db3.name);
        }
        async #upgrade(db3, arg) {
          let { stores } = this.#config;
          const initReady = this.#initReady;
          this.#initReady = void 0;
          if (this.#config.upgrade) {
            const res = await this.#config.upgrade(this, db3, arg);
            if (res === false) return;
            if (typeof res === "object") stores = res;
          }
          for (const [name, schema] of Object.entries(stores)) {
            if (db3.objectStoreNames.contains(name)) {
              db3.deleteObjectStore(name);
            }
            const storeConfig = {};
            const indexes = [];
            for (const [key, desc] of Object.entries(schema)) {
              if (desc.autoIncrement) {
                storeConfig.autoIncrement = desc.autoIncrement;
              }
              if (desc.keyPath) {
                if (typeof storeConfig.keyPath === "string") {
                  storeConfig.keyPath = [storeConfig.keyPath, key];
                } else if (Array.isArray(storeConfig.keyPath)) {
                  storeConfig.keyPath.push(key);
                } else {
                  storeConfig.keyPath = key;
                }
              }
              if ("unique" in desc || "index" in desc) {
                indexes.push([key, { unique: Boolean(desc.unique) }]);
              }
            }
            if ("keyPath" in storeConfig === false && "autoIncrement" in storeConfig === false) {
              storeConfig.autoIncrement = true;
            }
            const store = db3.createObjectStore(name, storeConfig);
            indexes.forEach(([key, config]) => store.createIndex(key, key, config));
          }
          if (this.#config.populate) {
            if (debug) console.time(`db populate (${this.name})`);
            await this.#config.populate(this, db3, arg);
            if (debug) console.timeEnd(`db populate (${this.name})`);
          }
          this.#initReady = initReady;
        }
        #initReady;
        async init() {
          if (this.indexedDB) return this.indexedDB;
          if (this.#obsolete) {
            throw new DatabaseError("Database is obsolete");
          }
          if (debug) console.log("db init", this.#config.name);
          if (this.#initReady?.isPending) return this.#initReady;
          this.#initReady = defer();
          const {
            name,
            version
            /* , persistent */
          } = this.#config;
          const RETRIES = this.#config.retries;
          let retries = RETRIES + 1;
          const openOptions = {
            upgrade: async (...args) => this.#upgrade(...args),
            downgrade: async (...args) => this.#downgrade(...args)
          };
          const tryOpen = async () => {
            try {
              this.indexedDB = await _Database.open(name, version, openOptions);
              let missingStore = false;
              for (const storeName of Object.keys(this.#config.stores)) {
                if (!this.indexedDB.objectStoreNames.contains(storeName)) {
                  missingStore = true;
                  break;
                }
              }
              if (missingStore) {
                this.indexedDB.close();
                await _Database.delete(name);
                throw new DatabaseError(
                  `Missing object store in database ${name}, recreating...`
                );
              }
            } catch (err) {
              if (--retries) {
                console.groupCollapsed(
                  `Database opening fail (${err.name}), retry ${RETRIES - retries + 1}/${RETRIES}`
                );
                console.warn(err);
                console.groupEnd();
                await tryOpen();
              } else {
                this.#initReady.reject(this.indexedDB);
                throw err;
              }
            }
          };
          await tryOpen();
          this.#registerDB(this.indexedDB);
          this.ready.resolve();
          this.#initReady?.resolve(this.indexedDB);
          return this.indexedDB;
        }
        then(resolve, reject) {
          this.init().then(resolve, reject);
        }
        async destroy(arg) {
          this.indexedDB?.close();
          await _Database.delete(this.#config.name, arg);
        }
      };
    }
  });

  // 42/lib/type/any/arrify.js
  function arrify(val) {
    return val == null ? [] : Array.isArray(val) ? val : typeof val === "string" ? [val] : typeof val[Symbol.iterator] === "function" ? [...val] : [val];
  }
  var init_arrify = __esm({
    "42/lib/type/any/arrify.js"() {
    }
  });

  // 42/lib/type/string/segmentize.js
  function segmentize(source, delimiters = ".") {
    if (!delimiters) return [source];
    delimiters = arrify(delimiters);
    const segments = [];
    source = String(source);
    if (!source || delimiters.includes(source)) return segments;
    let buffer = "";
    let current = 0;
    const hasBackslashDelimiter = delimiters.includes("\\");
    let lastCharEscaped = false;
    while (current < source.length) {
      const char = source[current];
      if (!hasBackslashDelimiter) {
        if (char === "\\") {
          lastCharEscaped = true;
          current++;
          continue;
        }
        if (lastCharEscaped) {
          lastCharEscaped = false;
          buffer += char;
          current++;
          continue;
        }
      }
      if (delimiters.includes(char)) {
        if (current !== 0 && current !== source.length - 1) {
          segments.push(buffer);
          buffer = "";
        }
        current++;
        continue;
      }
      buffer += char;
      current++;
    }
    segments.push(buffer);
    return segments;
  }
  var init_segmentize = __esm({
    "42/lib/type/string/segmentize.js"() {
      init_arrify();
    }
  });

  // 42/lib/type/object/exists.js
  function exists(obj, path, options) {
    if (typeof options === "string") options = { delimiters: options };
    return exists.run(obj, segmentize(path, options?.delimiters));
  }
  var init_exists = __esm({
    "42/lib/type/object/exists.js"() {
      init_segmentize();
      exists.run = (obj, segments) => {
        let current = obj;
        for (const key of segments) {
          if (typeof current !== "object" || key in current === false) return false;
          current = current[key];
        }
        return true;
      };
      exists.segmentize = segmentize;
    }
  });

  // 42/lib/type/object/locate.js
  function locate(obj, path, options) {
    if (typeof options === "string") options = { delimiters: options };
    return locate.run(obj, segmentize(path, options?.delimiters), options);
  }
  function joinDelimiter(segments, options) {
    return segments.join(
      options.delimiters ? Array.isArray(options.delimiters) ? options.delimiters[0] : options.delimiters : "."
    );
  }
  var init_locate = __esm({
    "42/lib/type/object/locate.js"() {
      init_segmentize();
      locate.run = (obj, segments, options = {}) => {
        let current = (
          /** @type {any} */
          obj
        );
        if (options.ignoreCase) {
          const realSegments = [""];
          for (let seg of segments) {
            seg = seg.toLocaleLowerCase();
            if (seg !== "-" && seg.startsWith("-") && typeof current?.at === "function") {
              current = current.at(seg);
              continue;
            }
            if (typeof current !== "object" || seg === "__proto__" || seg === "constructor" && !Object.hasOwn(current, seg)) {
              return;
            }
            let found;
            for (const key in current) {
              if (Object.hasOwn(current, key)) {
                if (key.toLocaleLowerCase() === seg) {
                  realSegments.push(key);
                  found = true;
                  current = options.autobind && typeof current[key] === "function" ? current[key].bind(current) : current[key];
                  break;
                }
              }
            }
            if (!found) return;
          }
          if (options.returnPath) return joinDelimiter(realSegments, options);
        } else {
          for (const seg of segments) {
            if (seg !== "-" && seg.startsWith("-") && typeof current?.at === "function") {
              current = current.at(seg);
              continue;
            }
            if (typeof current !== "object" || seg in current === false || seg === "__proto__" || seg === "constructor" && !Object.hasOwn(current, seg)) {
              return;
            }
            current = options.autobind && typeof current[seg] === "function" ? current[seg].bind(current) : current[seg];
          }
          if (options.returnPath) return joinDelimiter(segments, options);
        }
        return current;
      };
      locate.segmentize = segmentize;
    }
  });

  // 42/lib/type/any/isPrimitive.js
  function isPrimitive(val) {
    if (val === null) return true;
    const type = typeof val;
    return type !== "object" && type !== "function";
  }
  var init_isPrimitive = __esm({
    "42/lib/type/any/isPrimitive.js"() {
    }
  });

  // 42/lib/type/object/allocate.js
  function allocate(obj, path, val, options) {
    if (typeof options === "string") options = { delimiters: options };
    return allocate.run(obj, segmentize(path, options?.delimiters), val, options);
  }
  var init_allocate = __esm({
    "42/lib/type/object/allocate.js"() {
      init_isPrimitive();
      init_segmentize();
      allocate.run = (obj, segments, val, options) => {
        let current = (
          /** @type {any} */
          obj
        );
        if (segments.length === 0) {
          for (const key of Object.keys(obj)) delete obj[key];
          Object.assign(obj, val);
          return true;
        }
        for (let i = 0, l = segments.length; i < l; i++) {
          const key = segments[i];
          if (key === "__proto__") return false;
          if (segments.length - 1 === i) {
            if (options?.descriptor) Object.defineProperty(current, key, val);
            else current[key] = val;
          } else {
            if (!current[key] || key in current && !Object.hasOwn(current, key)) {
              current[key] = {};
            } else if (isPrimitive(current[key])) {
              return false;
            }
            current = current[key];
          }
        }
        return true;
      };
      allocate.segmentize = segmentize;
    }
  });

  // 42/lib/type/object/deallocate.js
  function deallocate(obj, path, options) {
    if (typeof options === "string") options = { delimiters: options };
    return deallocate.run(obj, segmentize(path, options?.delimiters));
  }
  var init_deallocate = __esm({
    "42/lib/type/object/deallocate.js"() {
      init_segmentize();
      deallocate.run = (obj, segments) => {
        let current = obj;
        if (segments.length === 0) {
          for (const key in obj) if (Object.hasOwn(obj, key)) delete obj[key];
          return obj;
        }
        for (let i = 0, l = segments.length; i < l; i++) {
          const key = segments[i];
          if (typeof current !== "object" || key in current === false) return obj;
          if (segments.length - 1 === i) {
            if (Array.isArray(current)) current.splice(Number(key), 1);
            else delete current[key];
            return obj;
          }
          current = current[key];
        }
        return obj;
      };
      deallocate.segmentize = segmentize;
    }
  });

  // 42/lib/class/Locator.js
  var Locator;
  var init_Locator = __esm({
    "42/lib/class/Locator.js"() {
      init_exists();
      init_locate();
      init_allocate();
      init_deallocate();
      init_merge();
      Locator = class {
        constructor(value, options) {
          this.value = value ?? {};
          const delimiter = typeof options === "string" ? options : options?.delimiter ?? ".";
          this.delimiter = delimiter;
        }
        has(path) {
          return exists(this.value, path, this.delimiter);
        }
        get(path) {
          return locate(this.value, path, this.delimiter);
        }
        set(path, val) {
          allocate(this.value, path, val, this.delimiter);
        }
        delete(path) {
          deallocate(this.value, path, this.delimiter);
        }
        assign(path, val) {
          const prev = this.get(path);
          if (prev && typeof prev === "object") Object.assign(prev, val);
          else this.set(path, val);
        }
        merge(path, val) {
          const prev = this.get(path);
          if (prev && typeof prev === "object") merge(prev, val);
          else this.set(path, val);
        }
        clear() {
          for (const key in this.value) {
            if (Object.hasOwn(this.value, key)) delete this.value[key];
          }
        }
      };
    }
  });

  // 42/lib/class/Storable.js
  var DEFAULTS2, Storable;
  var init_Storable = __esm({
    "42/lib/class/Storable.js"() {
      init_Database();
      init_configure();
      init_defer();
      init_Locator();
      DEFAULTS2 = {
        name: "storable",
        delimiter: "."
      };
      Storable = class extends Locator {
        constructor(value, options) {
          super(value, options);
          this.config = configure(DEFAULTS2, options);
          this.ready = defer();
          this.store = new Database({
            ...this.config,
            // version: Date.now(),
            populate: async () => {
              await this.populate();
            }
          }).stores.store;
        }
        async populate() {
          const value = typeof this.config.populate === "function" ? await this.config.populate() : this.value;
          this.store.set("value", value);
          this.value = value;
        }
        async init() {
          await this.store;
          const prev = await this.store.get("value");
          if (prev !== void 0 && prev !== null) this.value = prev;
          else await this.populate();
          this.ready.resolve();
        }
        #pending;
        #writing;
        #queueSave(remove = false) {
          if (!this.#pending) {
            this.#pending = { promise: defer(), remove };
            if (!this.#writing) queueMicrotask(() => this.#writePending());
          }
          this.#pending.remove = remove;
          return this.#pending.promise;
        }
        async #writePending() {
          const { promise, remove } = this.#pending;
          this.#pending = void 0;
          this.#writing = promise;
          try {
            await (remove ? this.store.delete("value") : this.store.set("value", this.value));
            promise.resolve();
          } catch (err) {
            promise.reject(err);
          } finally {
            this.#writing = void 0;
            if (this.#pending) this.#writePending();
          }
        }
        /** @returns {Promise<void>} */
        save() {
          return this.#queueSave();
        }
        /**
         * Wait for mutations queued before this call to reach storage.
         * @returns {Promise<void>}
         */
        async flush() {
          await (this.#pending?.promise ?? this.#writing);
        }
        async set(path, value) {
          super.set(path, value);
          await this.save();
        }
        async delete(path) {
          super.delete(path);
          await this.save();
        }
        async clear() {
          super.clear();
          await this.#queueSave(true);
        }
      };
    }
  });

  // 42/api/fs/FileSystemError.js
  var FileSystemError;
  var init_FileSystemError = __esm({
    "42/api/fs/FileSystemError.js"() {
      FileSystemError = class _FileSystemError extends Error {
        static EPERM = 1;
        static ENOENT = 2;
        static EIO = 5;
        static EBADF = 9;
        static EACCES = 13;
        static EBUSY = 16;
        static EEXIST = 17;
        static ENOTDIR = 20;
        static EISDIR = 21;
        static EINVAL = 22;
        static EFBIG = 27;
        static ENOSPC = 28;
        static EROFS = 30;
        static ENOTEMPTY = 39;
        static ELOOP = 40;
        static ENOTSUP = 95;
        constructor(errno, path, description = "", options) {
          errno = Math.abs(errno);
          const message = _FileSystemError.descriptions[errno];
          const code2 = _FileSystemError.codes[errno];
          super(
            options?.auto === false ? description : `${message}${description ? ` (${description})` : ""}${path ? ` \u2018${path}\u2019` : ""}`
          );
          Object.defineProperty(this, "name", { value: "FileSystemError" });
          this.path = path;
          this.errno = errno;
          this.code = code2;
        }
      };
      FileSystemError.codes = {};
      for (const key of Object.keys(FileSystemError)) {
        FileSystemError.codes[FileSystemError[key]] = key;
      }
      FileSystemError.descriptions = {
        [FileSystemError.EPERM]: "Operation not permitted",
        [FileSystemError.ENOENT]: "No such file or directory",
        [FileSystemError.EIO]: "Input/output error",
        [FileSystemError.EBADF]: "Bad file descriptor",
        [FileSystemError.EACCES]: "Permission denied",
        [FileSystemError.EBUSY]: "Resource busy or locked",
        [FileSystemError.EEXIST]: "File exists",
        [FileSystemError.ENOTDIR]: "File is not a directory",
        [FileSystemError.EISDIR]: "File is a directory",
        [FileSystemError.EINVAL]: "Invalid argument",
        [FileSystemError.EFBIG]: "File is too big",
        [FileSystemError.ENOSPC]: "No space left on disk",
        [FileSystemError.EROFS]: "Cannot modify a read-only file system",
        [FileSystemError.ENOTEMPTY]: "Directory is not empty",
        [FileSystemError.ELOOP]: "Too many levels of symbolic links",
        [FileSystemError.ENOTSUP]: "Operation is not supported"
      };
    }
  });

  // 42/lib/syntax/path/sortPath.js
  function sortPath(paths, options) {
    const key = options?.key;
    const splitted = paths.map((path) => ({
      path,
      segments: (key === void 0 ? path : path[key]).split("/").map((item, i, arr) => i < arr.length - 1 ? `${item}/` : item).filter(Boolean)
      // TODO: use flatMap
    }));
    splitted.sort(({ segments: a2 }, { segments: b2 }) => {
      const l = Math.max(a2.length, b2.length);
      for (let i = 0; i < l; i++) {
        if (i in a2 === false) return -1;
        if (i in b2 === false) return 1;
        const c = a2[i].localeCompare(b2[i]);
        if (c === 0) continue;
        const aIsDir = a2[i].endsWith("/");
        const bIsDir = b2[i].endsWith("/");
        if (aIsDir === bIsDir) return c;
        if (aIsDir === false) return 1;
        if (bIsDir === false) return -1;
      }
      return 0;
    });
    return splitted.map(({ path }) => path);
  }
  var init_sortPath = __esm({
    "42/lib/syntax/path/sortPath.js"() {
    }
  });

  // 42/api/fs/isDirDescriptor.js
  function isDirDescriptor(desc) {
    if (desc == null || desc === 0 || Array.isArray(desc)) return false;
    return typeof desc === "object";
  }
  var init_isDirDescriptor = __esm({
    "42/api/fs/isDirDescriptor.js"() {
    }
  });

  // 42/lib/syntax/glob/isGlob.js
  function isExtglob(str) {
    if (typeof str !== "string" || str === "") {
      return false;
    }
    let match;
    while (match = /(\\).|([!*+?@]\(.*\))/g.exec(str)) {
      if (match[2]) return true;
      str = str.slice(match.index + match[0].length);
    }
    return false;
  }
  function isGlob(str) {
    if (typeof str !== "string" || str === "") {
      return false;
    }
    if (isExtglob(str)) return true;
    let match;
    while (match = GLOB_REGEX.exec(str)) {
      if (match[2]) return true;
      let idx = match.index + match[0].length;
      const open = match[1];
      const close = open ? chars[open] : false;
      if (open && close) {
        const n = str.indexOf(close, idx);
        if (n !== -1) idx = n + 1;
      }
      str = str.slice(idx);
    }
    return false;
  }
  var chars, GLOB_REGEX;
  var init_isGlob = __esm({
    "42/lib/syntax/glob/isGlob.js"() {
      chars = { "{": "}", "(": ")", "[": "]" };
      GLOB_REGEX = /\\(.)|(^!|\*|[)+.\]]\?|\[[^\\\]]+]|{[^\\}]+}|\(\?[!:=][^)\\]+\)|\([^|]+\|[^)\\]+\))/;
    }
  });

  // 42/lib/type/array/uniq.js
  function uniq(arr) {
    return [...new Set(arr)];
  }
  var init_uniq = __esm({
    "42/lib/type/array/uniq.js"() {
    }
  });

  // 42/lib/type/array/union.js
  function union(...args) {
    return [...new Set(args.flat())];
  }
  var init_union = __esm({
    "42/lib/type/array/union.js"() {
    }
  });

  // 42/lib/type/array/difference.js
  function difference(arr, ...args) {
    args = args.flat();
    return arr.filter((item) => !args.includes(item));
  }
  var init_difference = __esm({
    "42/lib/type/array/difference.js"() {
    }
  });

  // 42/lib/type/string/escapeRegExp.js
  var escapeRegExp;
  var init_escapeRegExp = __esm({
    "42/lib/type/string/escapeRegExp.js"() {
      escapeRegExp = (str) => str.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
    }
  });

  // 42/lib/syntax/glob.js
  function tokensToRegexArguments(tokens, options = {}) {
    if (typeof options === "string") options = { flags: options };
    const config = { ...DEFAULTS3, ...options };
    const { flags } = config;
    let body = "";
    for (let i = 0, l = tokens.length; i < l; i++) body += tokens[i].regex;
    if (config.exclude) {
      body += "(/.*?)?";
    } else if (!config.onlyFiles) body += "/?";
    return [flags && flags.includes("g") ? body : `^${body}$`, flags];
  }
  function glob(paths, patterns) {
    paths = arrify(paths);
    patterns = arrify(patterns);
    if (paths.length === 0 || patterns.length === 0) return [];
    let out = [];
    for (const pattern of patterns) {
      const [exclude, reg] = pattern.startsWith("!") ? [true, new Glob(pattern.slice(1), { exclude: true })] : [false, new Glob(pattern)];
      out = (exclude ? difference : union)(
        out,
        paths.filter((x) => reg.test(x))
      );
    }
    return uniq(out);
  }
  var parseGlob, DEFAULTS3, Glob, flattenKeys;
  var init_glob = __esm({
    "42/lib/syntax/glob.js"() {
      init_arrify();
      init_uniq();
      init_union();
      init_difference();
      init_escapeRegExp();
      init_locate();
      init_exists();
      init_isDirDescriptor();
      parseGlob = (source) => {
        let current = 0;
        const tokens = [];
        let type = "root";
        let buffer = "";
        const flush = () => {
          if (buffer) {
            tokens.push({ type: "text", value: buffer, regex: escapeRegExp(buffer) });
            buffer = "";
          }
        };
        while (current < source.length) {
          const char = source[current];
          if (char === "\\") {
            flush();
            const value = `\\` + source[++current];
            tokens.push({ type: "escaped", value, regex: value });
            current++;
            continue;
          }
          if (type === "braces") {
            if (char === "}") {
              const bracesParts = buffer.split(",").map(
                (part) => tokensToRegexArguments(parseGlob(part), {
                  flags: "g",
                  onlyFiles: true
                })[0]
              );
              tokens.push({
                type: "text",
                value: buffer,
                regex: `(?:${bracesParts.join("|")})`
              });
              buffer = "";
              type = "root";
              tokens.push({ type: "brace", value: "}", regex: "" });
              current++;
              continue;
            }
            buffer += char;
          }
          if (type === "root") {
            if (char === "{") {
              flush();
              type = "braces";
              tokens.push({ type: "brace", value: "{", regex: "" });
              current++;
              continue;
            }
            if (char === "/") {
              flush();
              if (tokens.at(-1)?.type === "all") {
                tokens.at(-1).regex = "(.*?/)?";
              } else {
                tokens.push({ type: "sep", value: "/", regex: "/" });
              }
              current++;
              continue;
            }
            if (char === "*") {
              const nextChar = source[current + 2];
              if (source[current + 1] === "*" && (nextChar === "/" || nextChar === void 0)) {
                tokens.push({ type: "all", value: "**", regex: ".*?" });
                current += 2;
                continue;
              } else {
                flush();
                tokens.push({ type: "multi", value: "*", regex: `[^/]*?` });
                current++;
                continue;
              }
            }
            if (char === "?") {
              flush();
              tokens.push({ type: "single", value: "?", regex: `[^/]` });
              current++;
              continue;
            }
            buffer += char;
          }
          current++;
        }
        flush();
        return tokens;
      };
      DEFAULTS3 = {
        onlyFiles: false,
        flags: void 0,
        exclude: false
      };
      Glob = class extends RegExp {
        constructor(pattern, options) {
          super(...tokensToRegexArguments(parseGlob(pattern), options));
          this.pattern = pattern;
        }
      };
      glob.test = (paths, patterns) => glob(paths, patterns).length > 0;
      flattenKeys = (obj, prefix = "") => {
        const out = [];
        if (!obj) return out;
        const stack = [{ entries: Object.entries(obj), index: 0, prefix }];
        while (stack.length > 0) {
          const frame = stack.at(-1);
          if (frame.index >= frame.entries.length) {
            stack.pop();
            continue;
          }
          const [key, val] = frame.entries[frame.index++];
          const path = `${frame.prefix}/${key}`;
          if (isDirDescriptor(val)) {
            out.push(path + "/");
            stack.push({ entries: Object.entries(val), index: 0, prefix: path });
          } else {
            out.push(path);
          }
        }
        return out;
      };
      glob.locate = (obj, patterns, options) => {
        patterns = arrify(patterns);
        if (patterns.length === 0) return [];
        let ignoreCase;
        let out = [];
        let flattened = {};
        for (const pattern of patterns) {
          if (!pattern) continue;
          const [exclude, tokens] = pattern.startsWith("!") ? [true, parseGlob(pattern.slice(1))] : [false, parseGlob(pattern)];
          const reg = new RegExp(...tokensToRegexArguments(tokens, options));
          ignoreCase = reg.ignoreCase;
          let paths = [];
          let current = "";
          let buffer = "";
          for (const { type, value } of tokens) {
            if (type === "all" || type === "multi") {
              const sub = locate(obj, current, { delimiters: "/", ignoreCase });
              paths = flattened[current] ?? flattenKeys(sub, current);
              flattened[current] ??= paths;
              break;
            } else if (type === "sep") {
              current = buffer;
              buffer += value;
            } else {
              buffer += value;
            }
          }
          if (paths.length === 0) {
            paths.push(
              ignoreCase ? locate(obj, buffer, {
                delimiters: "/",
                returnPath: true,
                ignoreCase
              }) : buffer.startsWith("/") ? buffer : "/" + buffer
            );
          }
          out = (exclude ? difference : union)(
            out,
            paths.filter((x) => reg.test(x))
          );
          if (exists(obj, pattern, "/")) {
            out.push(pattern.startsWith("/") ? pattern : "/" + pattern);
          }
        }
        flattened = void 0;
        return uniq(out);
      };
    }
  });

  // 42/api/env/realm/getDesktopRealm.js
  function getDesktopRealm() {
    if (globalThis.window === void 0) {
      return globalThis;
    }
    let realm2 = globalThis.window;
    while (realm2 !== globalThis.top) {
      if (realm2.name === "desktop") break;
      realm2 = realm2.parent;
    }
    return realm2;
  }
  var init_getDesktopRealm = __esm({
    "42/api/env/realm/getDesktopRealm.js"() {
    }
  });

  // 42/api/env/realm/inDesktopRealm.js
  var inDesktopRealm;
  var init_inDesktopRealm = __esm({
    "42/api/env/realm/inDesktopRealm.js"() {
      inDesktopRealm = globalThis.window !== void 0 && (globalThis.window === globalThis.top || globalThis.window.name === "desktop");
    }
  });

  // 42.system.js
  var system_default;
  var init_system = __esm({
    "42.system.js"() {
      system_default = {
        options: {
          apps: {
            defaultApps: {
              "application/x-shockwave-flash": "flash",
              "application/json": "code",
              "application/json5": "code",
              "text/*": "code",
              "text/markdown": "markdown",
              "text/html": "iframe",
              "text/x-bytebeat": "bytebeat",
              "image/*": "image",
              "audio/*": "media",
              "video/*": "media"
            }
          },
          themes: {
            current: "/42/themes/tribute/windows9x.theme.css",
            options: {
              windows9x: {
                scheme: "/c/users/windows93/interface/themes/windows9x/schemes/Windows 93.theme"
              }
            }
          }
        },
        env: {
          USER: "windows93",
          USERS_DIR: "/c/users",
          EDITOR: "code"
        }
      };
    }
  });

  // 42/api/system.js
  function assignEnv(...args) {
    const out = {
      PWD: "/",
      USER: "anonymous",
      USERS_DIR: "/users"
    };
    for (const item of args) {
      Object.assign(out, item);
    }
    Object.defineProperty(out, "HOME", {
      get() {
        return `${this.USERS_DIR}/${this.USER}`;
      }
    });
    return out;
  }
  var System, system;
  var init_system2 = __esm({
    "42/api/system.js"() {
      init_Emitter();
      init_getDesktopRealm();
      init_inDesktopRealm();
      init_merge();
      init_system();
      System = class extends Emitter {
        config = {};
        /** @type {any} */
        bios;
        /** @type {any} */
        kernel;
        /** @type {any} */
        desktop;
        /** @type {fileIndex} */
        fileIndex;
        /** @type {env} */
        env;
        /** @type {any} */
        transfer;
        polyfills = [];
        dev = globalThis.dev;
      };
      if (inDesktopRealm) {
        globalThis.sys42 ??= {};
        merge(globalThis.sys42, merge(system_default, globalThis.sys42));
      } else {
        globalThis.sys42 = getDesktopRealm().sys42;
      }
      if (globalThis.sys42 && globalThis.sys42 instanceof System) {
        system = globalThis.sys42;
      } else {
        system = new System();
        if (globalThis.sys42) {
          const { env, ...rest } = globalThis.sys42;
          Object.assign(system, rest);
          system.env = assignEnv(env);
        } else {
          system.env = assignEnv();
        }
        globalThis.sys42 = system;
      }
    }
  });

  // 42/lib/syntax/path/assertPath.js
  function assertPath(path) {
    const type = typeof path;
    if (type !== "string") {
      throw new TypeError(`The "path" argument must be a string: ${type}`);
    }
    return path;
  }
  var init_assertPath = __esm({
    "42/lib/syntax/path/assertPath.js"() {
    }
  });

  // 42/lib/syntax/path/normalizePath.js
  function normalizeString(path, allowAboveRoot) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code2;
    for (let i = 0, len = path.length; i <= len; ++i) {
      if (i < len) code2 = path.charCodeAt(i);
      else if (code2 === CHAR_FORWARD_SLASH) break;
      else code2 = CHAR_FORWARD_SLASH;
      if (code2 === CHAR_FORWARD_SLASH) {
        if (lastSlash === i - 1 || dots === 1) {
        } else if (lastSlash !== i - 1 && dots === 2) {
          if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
            if (res.length > 2) {
              const lastSlashIndex = res.lastIndexOf("/");
              if (lastSlashIndex === -1) {
                res = "";
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              }
              lastSlash = i;
              dots = 0;
              continue;
            } else if (res.length === 2 || res.length === 1) {
              res = "";
              lastSegmentLength = 0;
              lastSlash = i;
              dots = 0;
              continue;
            }
          }
          if (allowAboveRoot) {
            if (res.length > 0) res += `/..`;
            else res = "..";
            lastSegmentLength = 2;
          }
        } else {
          if (res.length > 0) res += "/" + path.slice(lastSlash + 1, i);
          else res = path.slice(lastSlash + 1, i);
          lastSegmentLength = i - lastSlash - 1;
        }
        lastSlash = i;
        dots = 0;
      } else if (code2 === CHAR_DOT && dots !== -1) {
        ++dots;
      } else {
        dots = -1;
      }
    }
    return res;
  }
  var CHAR_DOT, CHAR_FORWARD_SLASH;
  var init_normalizePath = __esm({
    "42/lib/syntax/path/normalizePath.js"() {
      init_assertPath();
      CHAR_DOT = 46;
      CHAR_FORWARD_SLASH = 47;
    }
  });

  // 42/lib/syntax/path/resolvePath.js
  function getCWD(options) {
    const cwd = options?.cwd ?? globalThis.sys42?.env?.PWD;
    if (typeof cwd === "string") return cwd;
    throw new TypeError(
      "Resolved a relative path without a current working directory (CWD)"
    );
  }
  function resolveWithOptions(options, ...segments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for (let i = segments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const path = i >= 0 ? segments[i] : getCWD(options);
      assertPath(path);
      if (path.length === 0) continue;
      resolvedPath = `${path}/${resolvedPath}`;
      resolvedAbsolute = path.charCodeAt(0) === SEPARATOR;
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
    return resolvedAbsolute ? resolvedPath.length > 0 ? `/${resolvedPath}` : "/" : resolvedPath.length > 0 ? resolvedPath : ".";
  }
  var SEPARATOR;
  var init_resolvePath = __esm({
    "42/lib/syntax/path/resolvePath.js"() {
      init_assertPath();
      init_normalizePath();
      SEPARATOR = 47;
    }
  });

  // 42/api/os/expandEnvVariables.js
  function expandEnvVariables(str, env, status = 0) {
    return str.replaceAll(/^~/g, () => env.HOME).replaceAll(/\$(\?|[\w.]+)|\${([^}]+)}/g, (_, a2, b2) => {
      const name = a2 || b2;
      if (name in env) return env[name];
      switch (name) {
        case "?":
          return status;
        default:
          return locate(env, name) ?? "";
      }
    });
  }
  var init_expandEnvVariables = __esm({
    "42/api/os/expandEnvVariables.js"() {
      init_locate();
    }
  });

  // 42/api/fs/normalizeFilename.js
  function safeDecodeURIComponent(str) {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }
  function normalizeFilename(path, options) {
    const out = safeDecodeURIComponent(
      resolveWithOptions(
        options,
        options?.expandEnvVariables === false ? path : expandEnvVariables(path, system.env)
      )
    );
    if (options?.preserveDir && path.endsWith("/") && out !== "/") {
      return out + "/";
    }
    return out;
  }
  function normalizeDirname(path, options) {
    const out = safeDecodeURIComponent(
      resolveWithOptions(
        options,
        options?.expandEnvVariables === false ? path : expandEnvVariables(path, system.env)
      )
    );
    if (out === "/") return out;
    return out + "/";
  }
  var init_normalizeFilename = __esm({
    "42/api/fs/normalizeFilename.js"() {
      init_system2();
      init_resolvePath();
      init_expandEnvVariables();
    }
  });

  // 42/lib/type/object/flatten.js
  function flatten(obj, options, prefix = "") {
    const out = (
      /** @type {[string, any][]} */
      []
    );
    if (typeof options === "string") options = { delimiter: options };
    const delimiter = options?.delimiter ?? ".";
    for (const [key, val] of Object.entries(obj)) {
      const pre = prefix.length > 0 ? prefix + delimiter : "";
      if (val && typeof val === "object" && (options?.array === true ? true : !Array.isArray(val))) {
        const res = flatten(val, options, pre + key);
        if (res.length > 0) {
          out.push(...res);
          continue;
        }
      }
      out.push([pre + key, val]);
    }
    return out;
  }
  var init_flatten = __esm({
    "42/lib/type/object/flatten.js"() {
      flatten.entries = (obj, delimiter = ".", cb, prefix = "", out = []) => {
        const pre = prefix.length > 0 ? prefix + delimiter : "";
        if (!cb) {
          for (const [key, val] of Object.entries(obj)) {
            if (val && typeof val === "object" && !Array.isArray(val)) {
              const prevLen = out.length;
              flatten.entries(val, delimiter, cb, pre + key, out);
              if (out.length > prevLen) continue;
            }
            out.push([pre + key, val]);
          }
          return out;
        }
        for (const [key, val] of Object.entries(obj)) {
          if (val && typeof val === "object" && !Array.isArray(val)) {
            const prevLen = out.length;
            flatten.entries(val, delimiter, cb, pre + key, out);
            if (out.length > prevLen) continue;
          }
          cb(key, val, obj, pre);
        }
      };
      flatten.keys = (obj, delimiter = ".", cb, prefix = "", out = []) => {
        const pre = prefix.length > 0 ? prefix + delimiter : "";
        if (!cb) {
          for (const [key, val] of Object.entries(obj)) {
            if (val && typeof val === "object" && !Array.isArray(val)) {
              const prevLen = out.length;
              flatten.keys(val, delimiter, cb, pre + key, out);
              if (out.length > prevLen) continue;
            }
            out.push(pre + key);
          }
          return out;
        }
        for (const [key, val] of Object.entries(obj)) {
          if (val && typeof val === "object" && !Array.isArray(val)) {
            const prevLen = out.length;
            flatten.keys(val, delimiter, cb, pre + key, out);
            if (out.length > prevLen) continue;
          }
          cb(key, val, obj, pre);
        }
      };
    }
  });

  // 42/lib/browser/updateCache.js
  async function updateCache(path, options) {
    if (!navigator.onLine && options?.force !== true) return;
    if (Array.isArray(path)) {
      if (path.length === 0) return;
      const urlMatches = new Set(path.map((p2) => new Request(p2).url));
      return caches.keys().then(
        (keys) => Promise.all(
          keys.map(async (key) => {
            const cache = await caches.open(key);
            const requests = await cache.keys();
            return Promise.all(
              requests.map(async (req) => {
                if (urlMatches.has(req.url)) {
                  await cache.delete(req);
                  if (options?.delete !== true) await cache.add(req.url);
                }
              })
            );
          })
        )
      );
    }
    if (await caches.match(path)) {
      return caches.keys().then(
        (keys) => Promise.all(
          keys.map(async (key) => {
            const cache = await caches.open(key);
            if (await cache.match(path)) {
              await cache.delete(path);
              if (options?.delete !== true) await cache.add(path);
            }
          })
        )
      );
    }
  }
  var init_updateCache = __esm({
    "42/lib/browser/updateCache.js"() {
    }
  });

  // 42/api/fs/FileLocator.js
  var DEFAULTS4, BaseStore, BaseLocator, FileLocator;
  var init_FileLocator = __esm({
    "42/api/fs/FileLocator.js"() {
      init_Emittable();
      init_Storable();
      init_Locator();
      init_exists();
      init_FileSystemError();
      init_configure();
      init_sortPath();
      init_isDirDescriptor();
      init_isGlob();
      init_glob();
      init_normalizeFilename();
      init_flatten();
      init_inDesktopRealm();
      init_locate();
      init_updateCache();
      init_arrify();
      DEFAULTS4 = {
        name: "fileindex",
        delimiter: "/"
        // durability: "relaxed",
      };
      BaseStore = Storable;
      BaseLocator = /** @type {typeof Storable} */
      inDesktopRealm ? BaseStore : Locator;
      FileLocator = class extends Emittable(BaseLocator) {
        constructor(value, options) {
          super(value, configure(DEFAULTS4, options));
        }
        async init() {
          if (inDesktopRealm) return super.init();
        }
        /**
         * @param {string | string[]} dirnames
         * @returns {Promise<void>}
         */
        async upgrade(dirnames) {
          if (!inDesktopRealm) throw new Error("fileIndex.upgrade not available");
          dirnames = arrify(dirnames).map((dirname) => normalizeDirname(dirname));
          const undones = [];
          undones.push(this.config.populate({ fresh: true }));
          for (const dirname of dirnames) {
            const oldDir = locate(this.value, dirname, this.delimiter);
            if (oldDir) {
              const paths = flatten.keys(oldDir, this.delimiter).map((key) => dirname + key);
              undones.push(updateCache(paths, { delete: true }));
            }
          }
          const [files] = await Promise.all(undones);
          let hasChanges = false;
          for (const dirname of dirnames) {
            const newDir = locate(files, dirname, this.delimiter);
            if (newDir) {
              for (const [key, val] of flatten.entries(newDir, this.delimiter)) {
                Locator.prototype.set.call(this, dirname + key, val);
                hasChanges = true;
              }
            }
          }
          if (hasChanges && this.store) {
            await this.save();
          }
        }
        get(path) {
          try {
            path = decodeURIComponent(path);
          } catch {
          }
          const desc = super.get(path);
          return desc;
        }
        async set(path, inode, options) {
          let changes;
          if (options?.silent !== true) {
            changes = [];
            const segments = exists.segmentize(path, this.delimiter);
            if (segments.pop() === ".directory") {
              const path2 = `/${segments.join("/")}/`;
              changes.push(path2);
            }
            while (segments.length > 0) {
              if (!exists.run(this.value, segments)) {
                const path2 = `/${segments.join("/")}/`;
                changes.push(path2);
              }
              segments.pop();
            }
          }
          await super.set(path, inode);
          if (isDirDescriptor(inode)) path += "/";
          if (changes) {
            for (let i = changes.length - 1; i >= 0; i--) {
              if (options?.changeId === void 0) {
                this.emit("change", changes[i], "set");
              } else {
                this.emit("change", changes[i], "set", void 0, options.changeId);
              }
            }
            if (options?.changeId === void 0) {
              this.emit("change", path, "set", inode);
            } else {
              this.emit("change", path, "set", inode, options.changeId);
            }
          }
        }
        async delete(path, options) {
          let changes;
          if (options?.silent !== true) {
            if (this.isDir(path)) {
              changes ??= [];
              this.readDir(
                path,
                { absolute: true, recursive: true },
                (path2) => changes.push(path2)
              );
              changes.push(path);
            } else {
              changes ??= [];
              changes.push(path);
            }
          }
          await super.delete(path);
          if (changes) {
            for (const path2 of changes) {
              this.emit("change", path2, "delete", options?.changeId);
            }
          }
        }
        async clear(options) {
          let changes;
          if (options?.silent !== true) {
            changes ??= [];
            this.readDir(
              "/",
              { absolute: true, recursive: true },
              (path) => changes.push(path)
            );
          }
          await super.clear();
          if (changes) {
            for (const path of changes) {
              this.emit("change", path, "delete", options?.changeId);
            }
          }
        }
        copy(from, to, options) {
          const inode = this.get(from);
          if (inode === 0) {
            if (options?.delete) this.delete(from, options);
            this.set(to, location.origin + from);
            return;
          }
          if (typeof inode === "string") {
            if (options?.delete) this.delete(from, options);
            this.set(to, inode);
            return;
          }
          if (options?.delete) this.delete(from, options);
          this.set(to, inode);
        }
        move(from, to, options) {
          this.copy(from, to, { delete: true, ...options });
        }
        watch(pattern, options, fn) {
          pattern = normalizeFilename(pattern);
          if (typeof options === "function") fn = options;
          const signal = options?.signal;
          if (isGlob(pattern)) {
            const glob2 = new Glob(pattern);
            return this.on("change", { signal, off: true }, (path, type, inode) => {
              if (glob2.test(path)) fn(path, type, inode);
            });
          }
          return this.on("change", { signal, off: true }, (path, type, inode) => {
            if (path === pattern) fn(path, type, inode);
          });
        }
        glob(patterns, options) {
          patterns = arrify(patterns);
          patterns.push("!/trash/**");
          const paths = glob.locate(this.value, patterns, options);
          return options?.sort === false ? paths : sortPath(paths, options?.sort);
        }
        isDir(path) {
          return isDirDescriptor(this.get(path));
        }
        isFile(path) {
          const desc = this.get(path);
          return Array.isArray(desc) || desc === 0 || typeof desc === "string";
        }
        isLink(path) {
          const desc = this.get(path);
          return typeof desc === "string";
        }
        link(from, to) {
          from = normalizeFilename(from);
          to = normalizeFilename(to);
          if (from === to) {
            throw new FileSystemError(
              FileSystemError.ELOOP,
              from,
              `symbolic link refer to itself`
            );
          }
          const seen = /* @__PURE__ */ new Set([to]);
          let lookup2 = from;
          while (typeof lookup2 === "string") {
            if (seen.has(lookup2)) {
              throw new FileSystemError(FileSystemError.ELOOP, from, "circular link");
            }
            seen.add(lookup2);
            lookup2 = super.get(lookup2);
          }
          const desc = this.get(from);
          if (desc === void 0) {
            throw new FileSystemError(FileSystemError.ENOENT, from);
          }
          this.set(to, from);
        }
        /**
         * @param {string} path
         * @param {{recursive?: true, absolute?: true, sort?: false }} [options]
         * @param {(path: string) => void} [cb]
         */
        readDir(path, options = {}, cb) {
          const { recursive, absolute } = options;
          const dir = this.get(path);
          if (dir === void 0) {
            throw new FileSystemError(FileSystemError.ENOENT, path);
          } else if (!isDirDescriptor(dir)) {
            throw new FileSystemError(FileSystemError.ENOTDIR, path);
          }
          if (path !== "/") {
            if (!path.startsWith("/")) path = "/" + path;
            if (!path.endsWith("/")) path += "/";
          }
          const root = absolute ? path : "";
          let names;
          if (!cb) {
            names = [];
            cb = names.push.bind(names);
          }
          if (recursive) {
            const recurse = (currentDir, parentPath) => {
              for (const [key, desc] of Object.entries(currentDir)) {
                if (isDirDescriptor(desc)) {
                  const path2 = `${parentPath}${key}/`;
                  if (Object.keys(desc).length === 0) cb(`${root}${path2}`);
                  else recurse(desc, path2);
                } else {
                  cb(`${root}${parentPath}${key}`);
                }
              }
            };
            recurse(dir, "");
          } else if (absolute) {
            for (const [key, desc] of Object.entries(dir)) {
              cb(isDirDescriptor(desc) ? `${root}${key}/` : `${root}${key}`);
            }
          } else {
            for (const [key, desc] of Object.entries(dir)) {
              cb(isDirDescriptor(desc) ? `${key}/` : key);
            }
          }
          if (names) return options.sort === false ? names : sortPath(names);
        }
      };
    }
  });

  // 42/api/fs/FileIndex.js
  var FS_DRIVER_MASKS, fileIndex, FileIndex;
  var init_FileIndex = __esm({
    "42/api/fs/FileIndex.js"() {
      init_FileLocator();
      init_merge();
      FS_DRIVER_MASKS = {
        0: "fetch",
        16: "memory",
        17: "sessionstorage",
        18: "localstorage",
        19: "indexeddb",
        20: "opfs"
      };
      FileIndex = class extends FileLocator {
        synced = false;
        async init() {
          await super.init();
          if (this.store && this.config.populate && !this.isDir("/42/") && !this.isDir("/c/users/windows93/desktop/")) {
            const defaults = await this.config.populate({ fresh: true });
            this.value = merge(defaults, this.value);
            await this.save();
          }
        }
        constructor(value, options) {
          if (fileIndex) {
            console.warn("FileIndex already initialized");
            return fileIndex;
          }
          super(value, options);
          fileIndex = this;
        }
      };
    }
  });

  // 42/api/env/polyfill/ReadableStream.prototype.values.js
  var init_ReadableStream_prototype_values = __esm({
    "42/api/env/polyfill/ReadableStream.prototype.values.js"() {
      if (Symbol.asyncIterator in ReadableStream.prototype === false) {
        globalThis.sys42 ??= {};
        globalThis.sys42.polyfills ??= [];
        globalThis.sys42.polyfills.push("ReadableStream.prototype.values");
        ReadableStream.prototype.values = function({ preventCancel } = {}) {
          const reader = this.getReader();
          return {
            next() {
              return reader.read();
            },
            return() {
              if (preventCancel !== true) reader.cancel();
              reader.releaseLock();
              return {};
            },
            [Symbol.asyncIterator]() {
              return this;
            }
          };
        };
        ReadableStream.prototype[Symbol.asyncIterator] = ReadableStream.prototype.values;
      }
    }
  });

  // 42/api/fs/class/Driver.js
  var Driver;
  var init_Driver = __esm({
    "42/api/fs/class/Driver.js"() {
      Driver = class {
        /** @type {number} */
        mask;
        /** @type {any} */
        store;
        constructor(config) {
          this.config = config;
        }
        async init() {
          return this;
        }
        async getURL() {
          throw new Error(`${this.constructor.name}.getURL() is not implemented`);
        }
        /* check
        ======== */
        async access() {
          throw new Error(`${this.constructor.name}.access() is not implemented`);
        }
        async isFile() {
          throw new Error(`${this.constructor.name}.isFile() is not implemented`);
        }
        async isDir() {
          throw new Error(`${this.constructor.name}.isDir() is not implemented`);
        }
        async isLink() {
          throw new Error(`${this.constructor.name}.isLink() is not implemented`);
        }
        /* file
        ======= */
        async link() {
          throw new Error(`${this.constructor.name}.link() is not implemented`);
        }
        async open() {
          throw new Error(`${this.constructor.name}.open() is not implemented`);
        }
        async read(_filename, _options) {
          throw new Error(`${this.constructor.name}.read() is not implemented`);
        }
        async write(_filename, _data, _options) {
          throw new Error(`${this.constructor.name}.write() is not implemented`);
        }
        async delete() {
          throw new Error(`${this.constructor.name}.delete() is not implemented`);
        }
        async append() {
          throw new Error(`${this.constructor.name}.append() is not implemented`);
        }
        /* dir
        ====== */
        async writeDir() {
          throw new Error(`${this.constructor.name}.writeDir() is not implemented`);
        }
        async readDir() {
          throw new Error(`${this.constructor.name}.readDir() is not implemented`);
        }
        async deleteDir() {
          throw new Error(`${this.constructor.name}.deleteDir() is not implemented`);
        }
        /* stream
        ========= */
        /** @returns {Promise<WritableStream>} */
        async sink(_filename, _options) {
          throw new Error(`${this.constructor.name}.sink() is not implemented`);
        }
        /** @returns {Promise<ReadableStream>} */
        async source(_filename, _options) {
          throw new Error(`${this.constructor.name}.source() is not implemented`);
        }
      };
    }
  });

  // 42/lib/syntax/path/getBasename.js
  function getBasename(path, ext) {
    if (ext !== void 0 && typeof ext !== "string") {
      throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== void 0 && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return "";
      let extIdx = ext.length - 1;
      let firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        const code2 = path.charCodeAt(i);
        if (code2 === 47) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            if (code2 === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                end = i;
              }
            } else {
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) end = firstNonSlashEnd;
      else if (end === -1) end = path.length;
      return path.slice(start, end);
    }
    for (i = path.length - 1; i >= 0; --i) {
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
    }
    if (end === -1) return "";
    return path.slice(start, end);
  }
  var init_getBasename = __esm({
    "42/lib/syntax/path/getBasename.js"() {
      init_assertPath();
    }
  });

  // 42/lib/constant/FILE_TYPES.js
  var extnames, basenames, mimetypes, UTF8, a, b;
  var init_FILE_TYPES = __esm({
    "42/lib/constant/FILE_TYPES.js"() {
      extnames = {};
      basenames = {};
      mimetypes = {
        // Data interchange
        application: {
          "json": "json map topojson",
          "json5": "json5",
          "atom+xml": "atom",
          "cbor": "cbor",
          // [4]
          "octet-stream": "bin",
          "ld+json": "jsonld",
          "manifest+json": "webmanifest",
          "msgpack": "msp msgpack",
          "pdf": "pdf",
          "rss+xml": "rss",
          "vnd.geo+json": "geojson",
          "vnd.ms-fontobject": "eot",
          // [1]
          "wasm": "wasm",
          "webbundle": "wbn",
          "x-ndjson": "ndjson",
          "x-web-app-manifest+json": "webapp",
          "xml": "xml rdf",
          "xslt+xml": "xslt",
          "x-shockwave-flash": "swf",
          "x-navi-animation": "ani",
          // Archives
          "gzip": "gz tgz",
          "vnd.rar": "rar",
          "x-7z-compressed": "7z",
          "x-tar": "tar",
          "zip": "zip"
        },
        // Web fonts
        font: {
          ttf: "ttf",
          woff: "woff",
          woff2: "woff2",
          collection: "ttc",
          otf: "otf"
        },
        // Media files
        audio: {
          "mpeg": "mp3 mpga mp2 mp2a m2a m3a",
          "flac": "flac",
          "wav": "wav",
          "ogg": "oga ogg spx opus",
          "aac": "adts aac",
          "midi": "mid midi kar rmi",
          "mp4": "m4a f4a f4b mp4a",
          "webm": "weba",
          "x-aiff": "aif aiff aifc"
        },
        video: {
          "mp4": "mp4 f4v f4p m4v mp4v mpg4",
          "webm": "webm",
          "3gpp": "3gp",
          "ogg": "ogv",
          "quicktime": "mov",
          "x-flv": "flv",
          "x-matroska": "mkv",
          "x-ms-wmv": "wmv",
          "x-msvideo": "avi"
        },
        image: {
          "jpeg": "jpg jpeg jpe",
          "gif": "gif",
          "png": "png",
          "webp": "webp",
          "svg+xml": "svg svgz",
          "bmp": "bmp dib",
          "apng": "apng",
          "avif": "avif",
          "tiff": "tif tiff",
          "x-icon": "ico cur"
          // [2]
        },
        text: {
          "plain": "txt conf log me faq desktop directory",
          "html": "html htm xhtml",
          "css": "css",
          "javascript": "js mjs",
          // [3]
          "markdown": "md markdown",
          "cache-manifest": "manifest mf appcache",
          "calendar": "ics",
          "csv": "csv",
          "php": "php",
          "tab-separated-values": "tsv",
          "vcard": "vcard vcf",
          "vnd.rim.location.xloc": "xloc",
          "vtt": "vtt",
          "x-ansi": "ans",
          "x-component": "htc",
          "x-nfo": "nfo"
        }
      };
      UTF8 = {
        application: [
          "atom+xml",
          "json",
          "ld+json",
          "manifest+json",
          "rss+xml",
          "vnd.geo+json",
          "vnd.rim.location.xloc",
          "x-bb-appworld",
          "x-web-app-manifest+json",
          "xml"
        ],
        image: [
          "svg+xml"
          //
        ],
        text: [
          "cache-manifest",
          "calendar",
          "css",
          "html",
          "javascript",
          "markdown",
          "plain",
          "vcard",
          "vnd.wap.wml",
          "vtt",
          "x-component",
          "xml"
        ]
      };
      for (const type in mimetypes) {
        if (Object.hasOwn(mimetypes, type)) {
          for (const subtype in mimetypes[type]) {
            if (Object.hasOwn(mimetypes[type], subtype)) {
              const infos = { mimetype: `${type}/${subtype}` };
              if (UTF8[type]?.includes(subtype)) infos.charset = "utf-8";
              infos.keep = true;
              infos.extnames = mimetypes[type][subtype].split(" ").map((x) => `.${x}`);
              mimetypes[type][subtype] = infos;
              for (const ext of infos.extnames) extnames[ext] = infos;
            }
          }
        }
      }
      a = [
        "manifest.json"
        //
      ];
      mimetypes.application["manifest+json"].basenames = a;
      for (const filename of a) {
        basenames[filename] = mimetypes.application["manifest+json"];
      }
      b = [
        "about",
        "authors",
        "contributor",
        "copying",
        "license",
        "readme",
        "todo"
      ];
      b.push(...b.map((name) => name.toUpperCase()));
      mimetypes.text.plain.basenames = b;
      for (const filename of b) {
        basenames[filename] = mimetypes.text.plain;
      }
    }
  });

  // 42/lib/syntax/path/getExtname.js
  function getExtname(path, options) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for (let i = path.length - 1; i >= 0; --i) {
      const code2 = path.charCodeAt(i);
      if (code2 === 47) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code2 === 46) {
        if (startDot === -1) {
          startDot = i;
        } else if (preDotState !== 1) {
          preDotState = 1;
        }
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return "";
    }
    const extname = path.slice(startDot, end);
    return options?.preserveCase ? extname : extname.toLowerCase();
  }
  var init_getExtname = __esm({
    "42/lib/syntax/path/getExtname.js"() {
      init_assertPath();
    }
  });

  // 42/lib/syntax/path/getMimetype.js
  function getMimetype(filename) {
    const ext = getExtname(filename);
    const infos = extnames[ext.toLowerCase()] ?? basenames[getBasename(filename).toLowerCase()];
    return infos?.mimetype;
  }
  var init_getMimetype = __esm({
    "42/lib/syntax/path/getMimetype.js"() {
      init_FILE_TYPES();
      init_getBasename();
      init_getExtname();
    }
  });

  // 42/api/io/setFileRelativePath.js
  function setFileRelativePath(file, relativePath) {
    if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      enumerable: true,
      writable: false,
      value: relativePath
    });
  }
  var init_setFileRelativePath = __esm({
    "42/api/io/setFileRelativePath.js"() {
    }
  });

  // 42/lib/type/function/noop.js
  function noop() {
  }
  var init_noop = __esm({
    "42/lib/type/function/noop.js"() {
      Object.freeze(noop);
    }
  });

  // 42/api/encodePath.js
  function encodePath(path) {
    return path.replaceAll("%", entities["%"]).replaceAll(" ", entities[" "]).replaceAll('"', entities['"']).replaceAll("?", entities["?"]).replaceAll("#", entities["#"]);
  }
  var entities;
  var init_encodePath = __esm({
    "42/api/encodePath.js"() {
      entities = {
        "%": "%25",
        " ": "%20",
        '"': "%22",
        "?": "%3F",
        "#": "%23"
      };
    }
  });

  // 42/api/os/ensureURL.js
  async function ensureURL(url, options) {
    if (options?.ignoreFileSystem !== true && !globalThis.navigator?.serviceWorker?.controller && globalThis.location?.origin && globalThis.sys42?.fs && typeof url === "string" && url.startsWith("blob:") === false) {
      const parsedURL = new URL(encodePath(url), location.origin);
      if (parsedURL.origin !== location.origin || parsedURL.protocol !== location.protocol) {
        return url;
      }
      let path = parsedURL.pathname;
      try {
        path = decodeURIComponent(path);
      } catch {
      }
      if (globalThis.sys42.fileIndex.get(path)) {
        url = await globalThis.sys42.fs.getURL(path, options);
      }
    }
    return url;
  }
  var init_ensureURL = __esm({
    "42/api/os/ensureURL.js"() {
      init_encodePath();
    }
  });

  // 42/lib/constant/HTTP_STATUS_CODES.js
  var HTTP_STATUS_CODES_exports = {};
  __export(HTTP_STATUS_CODES_exports, {
    HTTP_STATUS_CODES: () => HTTP_STATUS_CODES
  });
  var HTTP_STATUS_CODES;
  var init_HTTP_STATUS_CODES = __esm({
    "42/lib/constant/HTTP_STATUS_CODES.js"() {
      HTTP_STATUS_CODES = Object.freeze({
        100: "Continue",
        101: "Switching Protocols",
        102: "Processing",
        103: "Early Hints",
        200: "OK",
        201: "Created",
        202: "Accepted",
        203: "Non-Authoritative Information",
        204: "No Content",
        205: "Reset Content",
        206: "Partial Content",
        207: "Multi-Status",
        208: "Already Reported",
        226: "IM Used",
        300: "Multiple Choices",
        301: "Moved Permanently",
        302: "Found",
        303: "See Other",
        304: "Not Modified",
        305: "Use Proxy",
        307: "Temporary Redirect",
        308: "Permanent Redirect",
        400: "Bad Request",
        401: "Unauthorized",
        402: "Payment Required",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        406: "Not Acceptable",
        407: "Proxy Authentication Required",
        408: "Request Timeout",
        409: "Conflict",
        410: "Gone",
        411: "Length Required",
        412: "Precondition Failed",
        413: "Payload Too Large",
        414: "URI Too Long",
        415: "Unsupported Media Type",
        416: "Range Not Satisfiable",
        417: "Expectation Failed",
        418: "I'm a Teapot",
        421: "Misdirected Request",
        422: "Unprocessable Entity",
        423: "Locked",
        424: "Failed Dependency",
        425: "Unordered Collection",
        426: "Upgrade Required",
        428: "Precondition Required",
        429: "Too Many Requests",
        431: "Request Header Fields Too Large",
        451: "Unavailable For Legal Reasons",
        500: "Internal Server Error",
        501: "Not Implemented",
        502: "Bad Gateway",
        503: "Service Unavailable",
        504: "Gateway Timeout",
        505: "HTTP Version Not Supported",
        506: "Variant Also Negotiates",
        507: "Insufficient Storage",
        508: "Loop Detected",
        509: "Bandwidth Limit Exceeded",
        510: "Not Extended",
        511: "Network Authentication Required"
      });
    }
  });

  // 42/api/http.js
  async function handleStatus(res, url) {
    if (res.ok || res.status === 304) return res;
    HTTP_STATUS_CODES2 ??= await Promise.resolve().then(() => (init_HTTP_STATUS_CODES(), HTTP_STATUS_CODES_exports)).then((m) => m.HTTP_STATUS_CODES);
    throw new HTTPError(res, url);
  }
  async function normalizeBody(body, out, parent) {
    if (body instanceof FormData || body instanceof ReadableStream) return body;
    if (!out) out = new FormData();
    for (let [key, val] of Object.entries(body)) {
      if (parent) key = `${parent}[${key}]`;
      if (val.localName === "form") val = new FormData(val);
      else if (val.form) {
        const input = val;
        val = new FormData(val.form);
        for (const inputFormKey of val.keys()) {
          if (input.name !== inputFormKey) val.delete(inputFormKey);
        }
      }
      if (val instanceof FormData) {
        for (const [subkey, value] of val) {
          out.append(`${key}[${subkey}]`, value);
        }
        return;
      }
      if (typeof val === "object" && !(val instanceof File)) {
        normalizeBody(val, out, key);
      } else out.append(key, val);
    }
    return out;
  }
  async function request(url, options) {
    url = await ensureURL(url, options);
    try {
      if (options.encodePath) {
        url = encodePath(url);
        delete options.encodePath;
      }
      return await fetch(url, options);
    } catch (cause) {
      const infos = { url, reached: false };
      let message = "This url can't be reached";
      try {
        const res = await fetch(url, { ...options, mode: "no-cors" });
        infos.reached = true;
        if (res.status !== 0) {
          infos.status = res.status;
          infos.statusText = res.statusText;
          infos.headers = Object.fromEntries(res.headers);
        }
        message = 'This url can be reached using "no-cors" but the response is empty';
      } catch {
      }
      throw Object.assign(new Error(`${message} : ${url}`, { cause }), infos);
    }
  }
  function makeMethod(method) {
    return async (url, ...options) => {
      const config = configure(...options, { method });
      if (config.fresh === true) {
        delete config.fresh;
        await updateCache(url);
      }
      const res = await request(url, config);
      return handleStatus(res, url);
    };
  }
  function makeMethodWithBody(method) {
    return async (url, body, ...options) => {
      const config = configure(DEFAULTS5, ...options, { method });
      body = config.body ?? body;
      if (body) {
        config.body = config.headers["Content-Type"].startsWith(
          "application/json"
        ) ? JSON.stringify(body) : await normalizeBody(body);
      }
      const res = await request(url, config);
      return handleStatus(res, url);
    };
  }
  async function postJSON(url, body, ...options) {
    const config = configure(...options, POST_JSON_CONFIG);
    body = config.body ?? body;
    config.body = JSON.stringify(body);
    const res = await request(url, config);
    return handleStatus(res, url);
  }
  function makeStreamWithBody(requestMethod) {
    return (url, cb = noop, ...rest) => {
      const { readable, writable } = new TransformStream();
      requestMethod(url, readable, ...rest).then(cb);
      return writable;
    };
  }
  function makeStream(requestMethod) {
    return (url, options, ...rest) => {
      let { queuingStrategy, onHeaders, onSize } = options ?? {};
      let reader;
      const rs = new ReadableStream(
        {
          async pull(controller) {
            if (!reader) {
              const res = await requestMethod(url, options, ...rest);
              onHeaders?.(res.headers, rs);
              onSize?.(Number(res.headers.get("Content-Length")), rs);
              reader = res.body.getReader();
            }
            const { value, done } = await reader.read();
            if (done) controller.close();
            else controller.enqueue(value);
          }
        },
        queuingStrategy
      );
      rs.headers = (fn) => (onHeaders = fn, rs);
      rs.size = (fn) => (onSize = fn, rs);
      return rs;
    };
  }
  var DEFAULTS5, POST_JSON_CONFIG, HTTP_STATUS_CODES2, HTTPError, httpGet, httpHead, httpOptions, httpPost, httpPut, httpDelete, httpPatch, httpStreamGet, httpStreamPost, http;
  var init_http = __esm({
    "42/api/http.js"() {
      init_noop();
      init_updateCache();
      init_configure();
      init_ensureURL();
      init_encodePath();
      DEFAULTS5 = { referrerPolicy: "same-origin" };
      POST_JSON_CONFIG = {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" }
      };
      HTTPError = class extends Error {
        constructor(res, url) {
          const statusText = res.ok === false && (res.statusText === "OK" || res.statusText === "") && HTTP_STATUS_CODES2 ? HTTP_STATUS_CODES2[res.status] || res.statusText : res.statusText;
          url = String(url);
          if (res.url && url.endsWith(res.url) === false) url = res.url;
          super(`${res.status} ${statusText} : ${url}`);
          Object.defineProperty(this, "name", { value: "HTTPError" });
          this.url = url;
          this.status = res.status;
          this.statusText = statusText;
          this.headers = Object.fromEntries(res.headers);
        }
      };
      httpGet = makeMethod("GET");
      httpHead = makeMethod("HEAD");
      httpOptions = makeMethod("OPTIONS");
      httpPost = makeMethodWithBody("POST");
      httpPut = makeMethodWithBody("PUT");
      httpDelete = makeMethodWithBody("DELETE");
      httpPatch = makeMethodWithBody("PATCH");
      httpStreamGet = makeStream(httpGet);
      httpStreamPost = makeStreamWithBody(httpPost);
      http = /** @type {HTTP} */
      httpGet;
      http.get = httpGet;
      http.post = httpPost;
      http.head = httpHead;
      http.put = httpPut;
      http.delete = httpDelete;
      http.options = httpOptions;
      http.patch = httpPatch;
      http.postJSON = postJSON;
      http.stream = /** @type {HTTPStream} */
      httpStreamGet;
      http.source = httpStreamGet;
      http.sink = httpStreamPost;
      http.post.json = postJSON;
      http.stream.get = httpStreamGet;
      http.stream.post = httpStreamPost;
    }
  });

  // 42/api/io/responseToFile.js
  async function responseToFile(res, filename) {
    const type = res.headers.get("Content-Type")?.split(";")[0] || void 0;
    const lastModifiedString = res.headers.get("Last-Modified") || void 0;
    const lastModified = new Date(lastModifiedString).getTime();
    const basename = getBasename(filename ?? new URL(res.url, "file:").pathname);
    const arrayBuffer = await res.arrayBuffer();
    const file = new File([arrayBuffer], basename, { type, lastModified });
    if (filename) setFileRelativePath(file, filename);
    return file;
  }
  var init_responseToFile = __esm({
    "42/api/io/responseToFile.js"() {
      init_getBasename();
      init_setFileRelativePath();
    }
  });

  // 42/api/load/loadFile.js
  function loadFile(url, options) {
    return (
      /** @type {Promise<File>} */
      httpGet(url, options).then((res) => responseToFile(res, options?.filename))
    );
  }
  var init_loadFile = __esm({
    "42/api/load/loadFile.js"() {
      init_http();
      init_responseToFile();
    }
  });

  // 42/lib/type/binary/equalsArrayBufferView.js
  function equalsNaive(a2, b2) {
    for (let i = 0, l = a2.byteLength; i < l; i++) {
      if (a2[i] !== b2[i]) return false;
    }
    return true;
  }
  function equals32Bit(a2, b2) {
    const len = a2.byteLength;
    const compressable = Math.floor(len / 4);
    const compressedA = new Uint32Array(a2.buffer, 0, compressable);
    const compressedB = new Uint32Array(b2.buffer, 0, compressable);
    for (let i = compressable * 4; i < len; i++) {
      if (a2[i] !== b2[i]) return false;
    }
    for (let i = 0, l = compressedA.byteLength; i < l; i++) {
      if (compressedA[i] !== compressedB[i]) return false;
    }
    return true;
  }
  function equalsArrayBufferView(a2, b2) {
    if (a2.byteLength !== b2.byteLength) return false;
    return a2.byteLength < 1e3 ? equalsNaive(a2, b2) : equals32Bit(a2, b2);
  }
  var init_equalsArrayBufferView = __esm({
    "42/lib/type/binary/equalsArrayBufferView.js"() {
    }
  });

  // 42/lib/class/Bytes.js
  var isLittleEndianMachine, supportResize, MAX_BYTE_LENGTH, MEMORY_PAGE, Bytes, p;
  var init_Bytes = __esm({
    "42/lib/class/Bytes.js"() {
      init_equalsArrayBufferView();
      isLittleEndianMachine = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
      supportResize = ArrayBuffer.prototype.resize !== void 0;
      MAX_BYTE_LENGTH = 1073741824;
      MEMORY_PAGE = 65536;
      Bytes = class _Bytes {
        #arr;
        #length;
        decoderOptions;
        static isLittleEndianMachine = isLittleEndianMachine;
        static from(value) {
          const buffer = new _Bytes();
          if (value == null) return buffer;
          if (typeof value === "string") buffer.writeText(value);
          else buffer.write(value);
          return buffer;
        }
        static alloc(length) {
          return new _Bytes({ length });
        }
        static equals(a2, b2) {
          return equalsArrayBufferView(a2, b2);
        }
        constructor(options) {
          options = typeof options === "number" ? { length: options } : options;
          const length = options?.length ?? 0;
          this.memory = supportResize ? {
            buffer: new ArrayBuffer(length, {
              maxByteLength: length > 0 ? length : options?.maxByteLength ?? MAX_BYTE_LENGTH
            })
          } : new WebAssembly.Memory({
            initial: 1 + Math.ceil((length - MEMORY_PAGE) / MEMORY_PAGE)
          });
          this.#arr = new Uint8Array(this.memory.buffer);
          this.#length = length;
          this.writeOffset = 0;
          this.offset = 0;
          this.encoding = options?.encoding ?? "utf8";
          if (options?.fatal !== void 0) {
            this.decoderOptions ??= {};
            this.decoderOptions.fatal = options?.fatal;
          }
          if (options?.ignoreBOM !== void 0) {
            this.decoderOptions ??= {};
            this.decoderOptions.ignoreBOM = options?.ignoreBOM;
          }
        }
        get byteLength() {
          return this.#length;
        }
        get length() {
          return this.#length;
        }
        set length(n) {
          this.#length = n;
          this.writeOffset = n;
          if (n > this.memory.buffer.byteLength) {
            if (supportResize) {
              this.memory.buffer.resize(n);
            } else {
              const remain = n - this.memory.buffer.byteLength;
              this.memory.grow(Math.ceil(remain / MEMORY_PAGE));
              this.#arr = new Uint8Array(this.memory.buffer);
              this.#view = void 0;
            }
          }
        }
        /** @type {DataView | undefined} */
        #view;
        get view() {
          this.#view ??= new DataView(this.memory.buffer);
          return this.#view;
        }
        get buffer() {
          return this.memory.buffer;
        }
        get value() {
          return this.memory.buffer.slice(0, this.#length);
        }
        go(offset = 0) {
          this.offset = offset;
          return this;
        }
        toArrayBuffer(start = 0, end = this.length) {
          return this.memory.buffer.slice(start, end);
        }
        at(n) {
          const abs = Math.abs(n);
          if (abs >= this.#length) return;
          return n < 0 ? this.#arr.at(this.#length + n) : this.#arr.at(n);
        }
        indexOf(value) {
          return this.#arr.indexOf(value);
        }
        fill(value, start = 0, end = this.length) {
          return this.#arr.fill(value, start, end);
        }
        subarray(start = 0, end = this.length) {
          return this.#arr.subarray(start, end);
        }
        slice(start = 0, end = this.length) {
          return new Uint8Array(this.memory.buffer.slice(start, end));
        }
        // MARK: byte
        writeByte(value, writeOffset = this.writeOffset) {
          const len = writeOffset + 1;
          if (len > this.length) this.length = len;
          this.#arr[writeOffset] = value;
          return 1;
        }
        readByte(offset = this.offset) {
          this.offset = offset + 1;
          return this.#arr[offset];
        }
        peekByte(offset = this.offset) {
          return this.#arr[offset];
        }
        // MARK: bytes
        write(value, writeOffset = this.writeOffset) {
          const len = writeOffset + value.byteLength;
          if (len > this.#length) this.length = len;
          this.#arr.set(new Uint8Array(value), writeOffset);
          return Uint8Array.BYTES_PER_ELEMENT;
        }
        read(length, offset = this.offset) {
          const arr = this.#arr.subarray(offset, offset + length);
          this.offset = offset + arr.byteLength;
          return arr;
        }
        peek(length, offset = this.offset) {
          return this.#arr.subarray(offset, offset + length);
        }
        // MARK: string
        #encoder;
        get encoder() {
          this.#encoder ??= new TextEncoder();
          return this.#encoder;
        }
        #decoder;
        get decoder() {
          this.#decoder ??= new TextDecoder(this.encoding, this.decoderOptions);
          return this.#decoder;
        }
        writeText(string, writeOffset = this.writeOffset) {
          const arr = this.encoder.encode(string);
          const len = writeOffset + arr.byteLength;
          if (len > this.#length) this.length = len;
          this.#arr.set(arr, writeOffset);
        }
        readText(length, offset = this.offset, encoding) {
          if (offset >= this.#length) return;
          const end = length === void 0 ? this.length : Math.min(offset + length, this.length);
          const arr = this.memory.buffer.slice(offset, end);
          if (end < this.offset) this.#decoder = void 0;
          this.offset = end;
          const decoder = encoding ? new TextDecoder(encoding) : this.decoder;
          return decoder.decode(arr, { stream: true });
        }
        peekText(length, offset = this.offset, encoding) {
          if (offset >= this.#length) return;
          const end = length === void 0 ? this.length : Math.min(offset + length, this.length);
          const arr = this.memory.buffer.slice(offset, end);
          const decoder = encoding ? new TextDecoder(encoding) : this.decoder;
          return decoder.decode(arr);
        }
        [Symbol.iterator]() {
          return this.#arr.subarray(0, this.#length)[Symbol.iterator]();
        }
        [Symbol.toPrimitive]() {
          return this.decoder.decode(this.memory.buffer.slice(0, this.#length));
        }
        toString() {
          return this[Symbol.toPrimitive]();
        }
      };
      p = Bytes.prototype;
      p.writeUint8 = p.writeByte;
      p.readUint8 = p.readByte;
      p.peekUint8 = p.peekByte;
      p.writeUint8Array = p.write;
      p.readUint8Array = p.read;
      p.peekUint8Array = p.peek;
      p.toUint8Array = p.slice;
      for (const getKey of Reflect.ownKeys(DataView.prototype)) {
        if (typeof getKey === "string" && getKey.startsWith("get") && getKey !== "getUint8") {
          const key = getKey.slice(3);
          const arrayKey = `${key}Array`;
          if (!(arrayKey in globalThis)) {
            console.log(arrayKey);
            continue;
          }
          const { BYTES_PER_ELEMENT } = globalThis[arrayKey];
          const setKey = `set${key}`;
          p[`write${key}`] = function(value, writeOffset = this.writeOffset, littleEndian) {
            const len = writeOffset + BYTES_PER_ELEMENT;
            if (len > this.length) this.length = len;
            this.view[setKey](writeOffset, value, littleEndian);
            return BYTES_PER_ELEMENT;
          };
          p[`read${key}`] = function(offset = this.offset, littleEndian) {
            this.offset = offset + BYTES_PER_ELEMENT;
            return this.view[getKey](offset, littleEndian);
          };
          p[`peek${key}`] = function(offset = this.offset, littleEndian) {
            return this.view[getKey](offset, littleEndian);
          };
          p[`read${key}Array`] = function(length, offset = this.offset, littleEndian) {
            const arr = this[`to${key}Array`](offset, offset + length, littleEndian);
            this.offset = arr.byteLength;
            return arr;
          };
          p[`peek${key}Array`] = function(length, offset = this.offset, littleEndian) {
            return this[`to${key}Array`](offset, offset + length, littleEndian);
          };
          p[`to${key}Array`] = function(start = 0, end = this.length, littleEndian) {
            const length = (end - start) / BYTES_PER_ELEMENT;
            const arr = new globalThis[arrayKey](length);
            const dataview = this.view;
            for (let i = 0; i < length; i++) {
              arr[i] = dataview[getKey](start + i * BYTES_PER_ELEMENT, littleEndian);
            }
            return arr;
          };
        }
      }
      Bytes.prototype.writeUint8;
      Bytes.prototype.writeUint16;
      Bytes.prototype.writeUint32;
      Bytes.prototype.writeInt8;
      Bytes.prototype.writeInt16;
      Bytes.prototype.writeInt32;
      Bytes.prototype.writeFloat16;
      Bytes.prototype.writeFloat32;
      Bytes.prototype.writeFloat64;
      Bytes.prototype.writeBigUint64;
      Bytes.prototype.writeBigInt64;
      Bytes.prototype.readUint8;
      Bytes.prototype.readUint16;
      Bytes.prototype.readUint32;
      Bytes.prototype.readInt8;
      Bytes.prototype.readInt16;
      Bytes.prototype.readInt32;
      Bytes.prototype.readFloat16;
      Bytes.prototype.readFloat32;
      Bytes.prototype.readFloat64;
      Bytes.prototype.readBigUint64;
      Bytes.prototype.readBigInt64;
      Bytes.prototype.peekUint8;
      Bytes.prototype.peekUint16;
      Bytes.prototype.peekUint32;
      Bytes.prototype.peekInt8;
      Bytes.prototype.peekInt16;
      Bytes.prototype.peekInt32;
      Bytes.prototype.peekFloat16;
      Bytes.prototype.peekFloat32;
      Bytes.prototype.peekFloat64;
      Bytes.prototype.peekBigUint64;
      Bytes.prototype.peekBigInt64;
      Bytes.prototype.writeUint8Array;
      Bytes.prototype.readUint8Array;
      Bytes.prototype.readUint16Array;
      Bytes.prototype.readUint32Array;
      Bytes.prototype.readInt8Array;
      Bytes.prototype.readInt16Array;
      Bytes.prototype.readInt32Array;
      Bytes.prototype.readFloat16Array;
      Bytes.prototype.readFloat32Array;
      Bytes.prototype.readFloat64Array;
      Bytes.prototype.readBigUint64Array;
      Bytes.prototype.readBigInt64Array;
      Bytes.prototype.peekUint8Array;
      Bytes.prototype.peekUint16Array;
      Bytes.prototype.peekUint32Array;
      Bytes.prototype.peekInt8Array;
      Bytes.prototype.peekInt16Array;
      Bytes.prototype.peekInt32Array;
      Bytes.prototype.peekFloat16Array;
      Bytes.prototype.peekFloat32Array;
      Bytes.prototype.peekFloat64Array;
      Bytes.prototype.peekBigUint64Array;
      Bytes.prototype.peekBigInt64Array;
      Bytes.prototype.toUint8Array;
      Bytes.prototype.toUint16Array;
      Bytes.prototype.toUint32Array;
      Bytes.prototype.toInt8Array;
      Bytes.prototype.toInt16Array;
      Bytes.prototype.toInt32Array;
      Bytes.prototype.toFloat16Array;
      Bytes.prototype.toFloat32Array;
      Bytes.prototype.toFloat64Array;
      Bytes.prototype.toBigUint64Array;
      Bytes.prototype.toBigInt64Array;
    }
  });

  // 42/api/fs/driver/ipcDriver.js
  var ipcDriver_exports = {};
  __export(ipcDriver_exports, {
    driver: () => driver
  });
  var IPCDriver, ignore, driver;
  var init_ipcDriver = __esm({
    "42/api/fs/driver/ipcDriver.js"() {
      init_BrowserDriver();
      init_ipc();
      IPCDriver = class extends BrowserDriver {
        async getURL(filename, options) {
          const objectURL = await ipc.ask("IPCDriver", {
            type: "getURL",
            args: [filename]
          });
          if (objectURL.startsWith("blob:")) {
            options?.signal.addEventListener("abort", () => {
              URL.revokeObjectURL(objectURL);
            });
          }
          return objectURL;
        }
      };
      ignore = /* @__PURE__ */ new Set(["constructor", "init", "getURL"]);
      for (const key of Reflect.ownKeys(BrowserDriver.prototype)) {
        if (ignore.has(key)) continue;
        IPCDriver.prototype[key] = async (...args) => ipc.ask("IPCDriver", { type: key, args });
      }
      driver = (...args) => new IPCDriver(...args).init();
    }
  });

  // 42/lib/type/binary/ensureArrayBuffer.js
  function ensureArrayBuffer(val) {
    const buffer = val instanceof ArrayBuffer ? val : typeof val === "string" ? new TextEncoder().encode(val) : val?.buffer;
    if (!buffer) {
      const type = getTypeOf(val);
      throw new TypeError(
        `Input value must be a string, ArrayBuffer or ArrayBufferView: ${type}`
      );
    }
    return buffer;
  }
  var init_ensureArrayBuffer = __esm({
    "42/lib/type/binary/ensureArrayBuffer.js"() {
      init_getTypeOf();
    }
  });

  // 42/lib/type/binary/base64.js
  function getLens(str) {
    const len = str.length;
    if (len % 4 > 0) {
      throw new Error("Invalid string. Length must be a multiple of 4");
    }
    let validLen = str.indexOf("=");
    if (validLen === -1) validLen = len;
    const placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [validLen, placeHoldersLen];
  }
  function byteLength(str) {
    const lens = getLens(str);
    const validLen = lens[0];
    const placeHoldersLen = lens[1];
    return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
  }
  function base64ToArrayBuffer(str) {
    let tmp;
    const lens = getLens(str);
    const validLen = lens[0];
    const placeHoldersLen = lens[1];
    const arr = new Uint8Array(
      (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen
    );
    let curByte = 0;
    const len = placeHoldersLen > 0 ? validLen - 4 : validLen;
    let i;
    for (i = 0; i < len; i += 4) {
      tmp = revLookup[str.charCodeAt(i)] << 18 | revLookup[str.charCodeAt(i + 1)] << 12 | revLookup[str.charCodeAt(i + 2)] << 6 | revLookup[str.charCodeAt(i + 3)];
      arr[curByte++] = tmp >> 16 & 255;
      arr[curByte++] = tmp >> 8 & 255;
      arr[curByte++] = tmp & 255;
    }
    if (placeHoldersLen === 2) {
      tmp = revLookup[str.charCodeAt(i)] << 2 | revLookup[str.charCodeAt(i + 1)] >> 4;
      arr[curByte++] = tmp & 255;
    }
    if (placeHoldersLen === 1) {
      tmp = revLookup[str.charCodeAt(i)] << 10 | revLookup[str.charCodeAt(i + 1)] << 4 | revLookup[str.charCodeAt(i + 2)] >> 2;
      arr[curByte++] = tmp >> 8 & 255;
      arr[curByte++] = tmp & 255;
    }
    return arr.buffer;
  }
  function tripletToBase64(num) {
    return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
  }
  function encodeChunk(uint8, start, end) {
    let str = "";
    for (let i = start; i < end; i += 3) {
      str += tripletToBase64(
        (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255)
      );
    }
    return str;
  }
  function base64FromArrayBuffer(buffer) {
    let tmp;
    const uint8 = new Uint8Array(buffer);
    const len = uint8.length;
    const extraBytes = len % 3;
    const maxChunkLength = 16383;
    let str = "";
    for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      str += encodeChunk(
        uint8,
        i,
        i + maxChunkLength > len2 ? len2 : i + maxChunkLength
      );
    }
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      str += lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==";
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1];
      str += lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=";
    }
    return str;
  }
  function base64Encode(val) {
    const buffer = ensureArrayBuffer(val);
    return base64FromArrayBuffer(buffer);
  }
  function base64Decode(str, options) {
    const buffer = base64ToArrayBuffer(str);
    if (typeof options === "string") options = { encoding: options };
    if (options?.encoding) {
      return new TextDecoder(options?.encoding).decode(buffer);
    }
    return buffer;
  }
  var lookup, revLookup, code, base64;
  var init_base64 = __esm({
    "42/lib/type/binary/base64.js"() {
      init_ensureArrayBuffer();
      lookup = [];
      revLookup = [];
      code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (let i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      base64 = {
        encode: base64Encode,
        decode: base64Decode,
        toArrayBuffer: base64ToArrayBuffer,
        fromArrayBuffer: base64FromArrayBuffer,
        byteLength
      };
    }
  });

  // 42/api/fs/driver/localstorageDriver.js
  var localstorageDriver_exports = {};
  __export(localstorageDriver_exports, {
    driver: () => driver2
  });
  var LocalStorageDriver, driver2;
  var init_localstorageDriver = __esm({
    "42/api/fs/driver/localstorageDriver.js"() {
      init_BrowserDriver();
      init_base64();
      LocalStorageDriver = class extends BrowserDriver {
        mask = 18;
        store = {
          has(id) {
            return localStorage.getItem(id) !== null;
          },
          async set(id, data) {
            data = data.type === "application/octet-stream" ? `42_BASE64:${base64.fromArrayBuffer(await data.arrayBuffer())}` : await data.text();
            localStorage.setItem(id, data);
          },
          get(id) {
            const data = localStorage.getItem(id);
            if (data === null) return;
            return new Blob(
              data.startsWith("42_BASE64:") ? [base64.toArrayBuffer(data.slice(10))] : [data]
            );
          },
          delete(id) {
            return localStorage.removeItem(id);
          }
        };
      };
      driver2 = (...args) => new LocalStorageDriver(...args).init();
    }
  });

  // 42/api/fs/driver/memoryDriver.js
  var memoryDriver_exports = {};
  __export(memoryDriver_exports, {
    driver: () => driver3
  });
  var MemoryDriver, driver3;
  var init_memoryDriver = __esm({
    "42/api/fs/driver/memoryDriver.js"() {
      init_BrowserDriver();
      MemoryDriver = class extends BrowserDriver {
        mask = 16;
        store = /* @__PURE__ */ new Map();
      };
      driver3 = (...args) => new MemoryDriver(...args).init();
    }
  });

  // 42/api/fs/driver/opfsDriver.js
  var opfsDriver_exports = {};
  __export(opfsDriver_exports, {
    driver: () => driver4
  });
  var STORE_DIRNAME, ENOENT, EISDIR, OpfsDriver, driver4;
  var init_opfsDriver = __esm({
    "42/api/fs/driver/opfsDriver.js"() {
      init_BrowserDriver();
      init_FileSystemError();
      init_uid();
      init_getBasename();
      init_getMimetype();
      init_setFileRelativePath();
      STORE_DIRNAME = ".sys42-fs";
      ({ ENOENT, EISDIR } = FileSystemError);
      OpfsDriver = class extends BrowserDriver {
        mask = 20;
        #directory;
        async init() {
          if (!globalThis.navigator?.storage?.getDirectory || !globalThis.FileSystemFileHandle?.prototype.createWritable) {
            if (this.getDriver) return this.getDriver("indexeddb");
            const { getDriverLazy: getDriverLazy2 } = await Promise.resolve().then(() => (init_getDriverLazy(), getDriverLazy_exports));
            return getDriverLazy2("indexeddb");
          }
          const root = await globalThis.navigator.storage.getDirectory();
          const storeDir = await root.getDirectoryHandle(STORE_DIRNAME, {
            create: true
          });
          this.#directory = storeDir;
          const getHandle = (id, options) => storeDir.getFileHandle(String(id), options);
          this.store = {
            has: async (id) => {
              try {
                await getHandle(id);
                return true;
              } catch (err) {
                if (err?.name === "NotFoundError") return false;
                throw err;
              }
            },
            get: async (id) => {
              try {
                const handle = await getHandle(id);
                return handle.getFile();
              } catch (err) {
                if (err?.name === "NotFoundError") return;
                throw err;
              }
            },
            set: async (id, data) => {
              const handle = await getHandle(id, { create: true });
              const writable = await handle.createWritable();
              try {
                await writable.write(data);
                await writable.close();
              } catch (err) {
                await writable.abort(err).catch(() => {
                });
                throw err;
              }
            },
            delete: async (id) => {
              try {
                await storeDir.removeEntry(String(id));
              } catch (err) {
                if (err?.name !== "NotFoundError") throw err;
              }
            }
          };
          return super.init();
        }
        async open(filename) {
          const blob = await super.open(filename);
          const basename = getBasename(filename);
          const file = new File([blob], basename, {
            type: blob.type || getMimetype(basename),
            lastModified: blob.lastModified
          });
          setFileRelativePath(file, filename);
          return file;
        }
        async write(filename, data) {
          const blob = new Blob([data]);
          const writable = await this.sink(filename);
          const writer = writable.getWriter();
          await writer.write(blob);
          await writer.close();
        }
        async append(filename, data) {
          const blob = new Blob([data]);
          const writable = await this.#sink(filename, true);
          const writer = writable.getWriter();
          await writer.write(blob);
          await writer.close();
        }
        async sink(filename) {
          return this.#sink(filename);
        }
        async #sink(filename, append = false) {
          const index = this.fileIndex;
          if (index.isDir(filename)) throw new FileSystemError(EISDIR, filename);
          if (append && !index.has(filename)) {
            throw new FileSystemError(ENOENT, filename);
          }
          const previous = index.get(filename);
          const own = Array.isArray(previous) && previous[1] === this.mask;
          const id = own ? previous[0] : uid();
          const previousDriver = !own && Array.isArray(previous) ? await this.getDriver(previous[1]) : void 0;
          const initial = append && !own ? await this.open(filename) : void 0;
          let writable;
          const discard = async (reason) => {
            await writable?.abort(reason).catch(() => {
            });
            if (!own) await this.store.delete(id);
          };
          try {
            const handle = await this.#directory.getFileHandle(String(id), {
              create: !append || !own
            });
            writable = await handle.createWritable({
              keepExistingData: append && own
            });
            if (append && own) {
              const file = await handle.getFile();
              await writable.seek(file.size);
            } else if (initial) {
              await writable.write(initial);
            }
          } catch (err) {
            await discard(err);
            if (err?.name === "NotFoundError") {
              throw new FileSystemError(ENOENT, filename);
            }
            throw err;
          }
          return new WritableStream({
            write: async (chunk) => {
              try {
                await writable.write(chunk);
              } catch (err) {
                await discard(err);
                throw err;
              }
            },
            close: async () => {
              try {
                await writable.close();
              } catch (err) {
                await discard(err);
                throw err;
              }
              const time = Date.now();
              const metadata = Array.isArray(previous) ? { ...previous[2], c: time, m: time } : { b: time, a: time, c: time, m: time };
              await index.set(filename, [id, this.mask, metadata]);
              if (previousDriver) await previousDriver.store.delete(previous[0]);
            },
            abort: discard
          });
        }
      };
      driver4 = (...args) => new OpfsDriver(...args).init();
    }
  });

  // import("./driver/**/*Driver.js") in 42/api/fs/getDriverLazy.js
  var globImport_driver_Driver_js;
  var init_ = __esm({
    'import("./driver/**/*Driver.js") in 42/api/fs/getDriverLazy.js'() {
      globImport_driver_Driver_js = __glob({
        "./driver/indexeddbDriver.js": () => Promise.resolve().then(() => (init_indexeddbDriver(), indexeddbDriver_exports)),
        "./driver/ipcDriver.js": () => Promise.resolve().then(() => (init_ipcDriver(), ipcDriver_exports)),
        "./driver/localstorageDriver.js": () => Promise.resolve().then(() => (init_localstorageDriver(), localstorageDriver_exports)),
        "./driver/memoryDriver.js": () => Promise.resolve().then(() => (init_memoryDriver(), memoryDriver_exports)),
        "./driver/opfsDriver.js": () => Promise.resolve().then(() => (init_opfsDriver(), opfsDriver_exports))
      });
    }
  });

  // 42/api/fs/getDriverLazy.js
  var getDriverLazy_exports = {};
  __export(getDriverLazy_exports, {
    getDriverLazy: () => getDriverLazy
  });
  async function getDriverLazy(name) {
    const type = typeof name;
    if (type === "function") return name;
    name = type === "number" ? FS_DRIVER_MASKS[name] : name.toLowerCase();
    if (drivers[name]) return drivers[name];
    const { driver: driver6 } = await globImport_driver_Driver_js(`./driver/${name}Driver.js`);
    drivers[name] = await driver6(getDriverLazy);
    return drivers[name];
  }
  var drivers;
  var init_getDriverLazy = __esm({
    "42/api/fs/getDriverLazy.js"() {
      init_FileIndex();
      init_();
      drivers = {};
    }
  });

  // 42/api/fs/class/BrowserDriver.js
  var fileIndex2, ENOENT2, EISDIR2, EEXIST, ENOTDIR, ELOOP, EBADF, BrowserDriver;
  var init_BrowserDriver = __esm({
    "42/api/fs/class/BrowserDriver.js"() {
      init_ReadableStream_prototype_values();
      init_system2();
      init_Driver();
      init_FileIndex();
      init_uid();
      init_FileSystemError();
      init_getBasename();
      init_getMimetype();
      init_setFileRelativePath();
      init_loadFile();
      init_Bytes();
      ({ ENOENT: ENOENT2, EISDIR: EISDIR2, EEXIST, ENOTDIR, ELOOP, EBADF } = FileSystemError);
      BrowserDriver = class extends Driver {
        constructor(getDriver2) {
          super();
          this.getDriver = getDriver2;
          this.name = this.constructor.name.slice(0, -6).toLowerCase();
        }
        async init() {
          if (system.fileIndex) fileIndex2 = system.fileIndex;
          else {
            fileIndex2 = new FileIndex();
            await fileIndex2.init();
          }
          if (!this.getDriver) {
            const { getDriverLazy: getDriverLazy2 } = await Promise.resolve().then(() => (init_getDriverLazy(), getDriverLazy_exports));
            this.getDriver = getDriverLazy2;
          }
          this.fileIndex = fileIndex2;
          return this;
        }
        /* check
        ======== */
        async access(filename) {
          return fileIndex2.has(filename);
        }
        async getURL(filename, options) {
          if (!fileIndex2.has(filename)) {
            throw new FileSystemError(ENOENT2, filename);
          }
          if (navigator.serviceWorker?.controller) return filename;
          const inode = fileIndex2.get(filename);
          if (inode === 0) return filename;
          if (typeof inode === "string") {
            if (filename === inode) {
              throw new FileSystemError(
                ELOOP,
                filename,
                `symbolic link refer to itself`
              );
            }
            if (inode.startsWith("http://") || inode.startsWith("https://") || inode.startsWith("//")) {
              return inode;
            }
            return this.getURL(inode);
          }
          const blob = await this.open(filename);
          const objectURL = URL.createObjectURL(blob);
          if (options?.signal) {
            options.signal.addEventListener?.(
              "abort",
              () => URL.revokeObjectURL(objectURL)
            );
          } else {
            setTimeout(() => URL.revokeObjectURL(objectURL), 4e4);
          }
          return objectURL;
        }
        async isDir(filename) {
          return fileIndex2.isDir(filename);
        }
        async isFile(filename) {
          return fileIndex2.isFile(filename);
        }
        async isLink(filename) {
          return fileIndex2.isLink(filename);
        }
        async link(from, to) {
          return fileIndex2.link(from, to);
        }
        /* file
        ======= */
        async open(filename) {
          if (!fileIndex2.has(filename)) throw new FileSystemError(ENOENT2, filename);
          else if (fileIndex2.isDir(filename)) {
            throw new FileSystemError(EISDIR2, filename);
          }
          const inode = fileIndex2.get(filename);
          let blob;
          if (inode === 0) {
            blob = await loadFile(filename, { filename, encodePath: true });
          } else if (typeof inode === "string") {
            if (filename === inode) {
              throw new FileSystemError(EBADF, filename, `File link refer to itself`);
            }
            if (inode.startsWith("http://") || inode.startsWith("https://") || inode.startsWith("//")) {
              blob = await loadFile(inode, { filename });
            } else {
              return this.open(inode);
            }
          } else {
            const [id, mask] = inode;
            inode[2].a = Date.now();
            fileIndex2.set(filename, inode, { silent: true });
            if (this.mask !== mask) {
              const driver6 = await this.getDriver(mask);
              return driver6.open(filename);
            }
            blob = await this.store.get(id);
            if (blob) setFileRelativePath(blob, filename);
          }
          if (blob === void 0) {
            fileIndex2.delete(filename, { silent: true });
            throw new FileSystemError(ENOENT2, filename);
          }
          return blob;
        }
        async read(filename, options) {
          if (typeof options === "string") options = { encoding: options };
          const encoding = options?.encoding;
          const blob = await this.open(filename);
          const buf = await blob.arrayBuffer();
          return encoding ? new TextDecoder(encoding).decode(buf) : buf;
        }
        async write(filename, data, options) {
          if (fileIndex2.isDir(filename)) throw new FileSystemError(EISDIR2, filename);
          if (typeof options === "string") options = { encoding: options };
          let id;
          let inode = fileIndex2.get(filename);
          if (inode && typeof inode !== "string") {
            id = inode[0];
            const mask = inode[1];
            if (this.mask !== mask) {
              const driver6 = await this.getDriver(mask);
              driver6.delete(filename);
            }
            inode[2].m = Date.now();
            fileIndex2.set(filename, inode);
          } else {
            id = uid();
            const time = Date.now();
            inode = [
              id,
              this.mask,
              {
                b: time,
                // File creation (birth)
                a: time,
                // Last access
                c: time,
                // Last status change
                m: time
                // Last modification
              }
            ];
            fileIndex2.set(filename, inode);
          }
          const basename = getBasename(filename);
          await this.store.set(
            id,
            new File([data], basename, {
              type: getMimetype(basename),
              lastModified: inode[2].m
            })
          );
        }
        async append(filename, data, options) {
          if (!fileIndex2.has(filename)) throw new FileSystemError(ENOENT2, filename);
          else if (fileIndex2.isDir(filename)) {
            throw new FileSystemError(EISDIR2, filename);
          }
          if (typeof options === "string") options = { encoding: options };
          const inode = fileIndex2.get(filename);
          const id = inode === 0 ? uid() : inode[0];
          const prev = await this.open(filename);
          return this.store.set(id, new Blob([prev, data]));
        }
        async delete(filename) {
          if (!fileIndex2.has(filename)) throw new FileSystemError(ENOENT2, filename);
          else if (fileIndex2.isDir(filename)) {
            throw new FileSystemError(EISDIR2, filename);
          }
          const inode = fileIndex2.get(filename);
          if (inode && typeof inode !== "string") {
            const [id, mask] = inode;
            if (this.mask !== mask) {
              const driver6 = await this.getDriver(mask);
              await driver6.delete(filename);
              return;
            }
            await this.store.delete(id);
          }
          fileIndex2.delete(filename);
        }
        /* dir
        ====== */
        async writeDir(filename) {
          if (fileIndex2.has(filename) && fileIndex2.isFile(filename)) {
            throw new FileSystemError(EEXIST, filename);
          }
          fileIndex2.set(filename, {});
        }
        async readDir(filename, options) {
          return fileIndex2.readDir(filename, options);
        }
        async deleteDir(filename) {
          if (!fileIndex2.has(filename)) throw new FileSystemError(ENOENT2, filename);
          else if (!fileIndex2.isDir(filename)) {
            throw new FileSystemError(ENOTDIR, filename);
          }
          await Promise.all(
            fileIndex2.readDir(filename, { absolute: true }).map(
              (path) => path.endsWith("/") ? this.deleteDir(path) : this.delete(path)
            )
          );
          fileIndex2.delete(filename);
        }
        /* stream
        ========= */
        async sink(filename, options) {
          const buf = new Bytes();
          return new WritableStream({
            write(chunk) {
              buf.write(chunk);
            },
            close: async () => {
              await this.write(filename, buf.value, options);
            }
          });
        }
        async source(filename, options) {
          if (typeof options === "string") options = { encoding: options };
          const blob = await this.open(filename);
          let stream = blob.stream();
          if (options?.encoding) {
            stream = stream.pipeThrough(new TextDecoderStream(options.encoding));
          }
          return stream;
        }
      };
    }
  });

  // 42/api/fs/driver/indexeddbDriver.js
  var indexeddbDriver_exports = {};
  __export(indexeddbDriver_exports, {
    driver: () => driver5
  });
  var db, IndexedDBDriver, driver5;
  var init_indexeddbDriver = __esm({
    "42/api/fs/driver/indexeddbDriver.js"() {
      init_BrowserDriver();
      init_Database();
      db = new Database("fs");
      IndexedDBDriver = class extends BrowserDriver {
        mask = 19;
        store = db.store;
      };
      driver5 = (...args) => new IndexedDBDriver(...args).init();
    }
  });

  // 42.sw.js
  init_ipc();
  init_FileIndex();

  // 42/api/fs/getDriver.js
  init_FileIndex();
  init_indexeddbDriver();
  init_localstorageDriver();
  init_memoryDriver();
  init_opfsDriver();
  var modules = {
    indexeddb: driver5,
    localstorage: driver2,
    memory: driver3,
    opfs: driver4
  };
  var drivers2 = {};
  async function getDriver(name) {
    const type = typeof name;
    if (type === "function") return name;
    name = type === "number" ? FS_DRIVER_MASKS[name] : name.toLowerCase();
    if (drivers2[name]) return drivers2[name];
    drivers2[name] = await modules[name](getDriver);
    return drivers2[name];
  }

  // 42/lib/syntax/mimetype/parseMimetype.js
  function parseMimetype(mimetype) {
    let [type, subtype = "*"] = mimetype.trim().toLowerCase().split("/");
    const [prefix, suffix = ""] = subtype.split("+");
    type ||= "*";
    return {
      essence: `${type}/${subtype}`,
      type,
      subtype,
      prefix,
      suffix
    };
  }

  // 42/lib/syntax/path/parsePath.js
  init_assertPath();
  var CHAR_DOT2 = 46;
  var CHAR_FORWARD_SLASH2 = 47;
  function parsePath(path, options) {
    assertPath(path);
    const res = {};
    res.root = "";
    res.dir = "";
    res.base = "";
    res.ext = "";
    res.name = "";
    if (path.length === 0) return res;
    let code2 = path.codePointAt(0);
    const isAbsolute = code2 === CHAR_FORWARD_SLASH2;
    let start;
    if (isAbsolute) {
      res.root = "/";
      start = 1;
    } else {
      start = 0;
    }
    if (options?.checkDir === true && path.endsWith("/")) {
      res.dir = path.slice(0, -1);
      return res;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for (; i >= start; --i) {
      code2 = path.codePointAt(i);
      if (code2 === CHAR_FORWARD_SLASH2) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code2 === CHAR_DOT2) {
        if (startDot === -1) startDot = i;
        else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute) {
          res.base = path.slice(1, end);
          res.name = res.base;
        } else {
          res.base = path.slice(startPart, end);
          res.name = res.base;
        }
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        res.name = path.slice(1, startDot);
        res.base = path.slice(1, end);
      } else {
        res.name = path.slice(startPart, startDot);
        res.base = path.slice(startPart, end);
      }
      res.ext = path.slice(startDot, end);
    }
    if (startPart > 0) res.dir = path.slice(0, startPart - 1);
    else if (isAbsolute) res.dir = "/";
    return res;
  }

  // 42/lib/syntax/path/getPathInfo.js
  init_FILE_TYPES();
  function getPathInfo(filename, options) {
    const index = options?.index;
    const { origin, protocol, host, hostname, port, pathname, search, hash } = new URL(filename, "file:");
    const out = { origin, protocol, host, hostname, port, pathname, search, hash };
    const isFileProtocol = out.protocol === "file:";
    if (isFileProtocol) out.origin = "file://";
    out.isURI = !isFileProtocol;
    out.isDir = !out.isURI && out.pathname.endsWith("/");
    out.isFile = !out.isURI && !out.isDir;
    if (index && out.isDir) {
      out.filename = decodeURI(`${out.pathname}${index}`);
      out.isDir = false;
      out.isFile = true;
    } else {
      out.filename = decodeURI(out.pathname);
    }
    const parsed = parsePath(out.filename);
    out.dir = parsed.dir;
    out.base = parsed.base;
    out.ext = out.isDir ? "" : parsed.ext;
    out.stem = out.isDir ? parsed.base : parsed.name;
    out.charset = void 0;
    if (out.isDir) {
      out.mimetype = "inode/directory";
    } else {
      const infos = extnames[out.ext.toLowerCase()] ?? basenames[out.base.toLowerCase()];
      if (infos) {
        out.charset = infos.charset;
        out.mimetype = infos.mimetype;
      } else {
        out.mimetype = "application/octet-stream";
      }
      if (options?.getURIMimetype === false && out.isURI) {
        out.mimetype = "text/x-uri";
      }
    }
    if (options?.headers) {
      out.headers = { ...options.headers };
      out.headers["Content-Type"] ??= out.mimetype + (out.charset ? `; charset=${out.charset}` : "");
    }
    if (options?.parseMimetype !== false) {
      out.mime = parseMimetype(out.mimetype);
    }
    return out;
  }

  // 42.sw.js
  init_Database();

  // 42/api/os/network/pageAssets.js
  var manifest;
  async function getManifest() {
    manifest ??= fetch("/asset-map.json", { cache: "no-cache" }).then((res) => res.ok ? res.json() : {}).catch(() => ({}));
    return manifest;
  }
  async function pageAssetResponse(pathname, request2) {
    if (!pathname.startsWith("/c/")) return;
    let path = pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
    }
    const asset = (await getManifest())[path];
    if (!asset) return;
    const response = await fetch(asset.url, { credentials: "same-origin" });
    if (!response.ok) return;
    const blob = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).blob();
    const { headers } = getPathInfo(path, { headers: { "Accept-Ranges": "bytes" } });
    const range = /^bytes=(\d*)-(\d*)$/.exec(request2.headers.get("Range") ?? "");
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, blob.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), blob.size - 1) : blob.size - 1;
      if (start > end || start >= blob.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } });
      }
      headers["Content-Range"] = `bytes ${start}-${end}/${blob.size}`;
      headers["Content-Length"] = end - start + 1;
      return new Response(blob.slice(start, end + 1), { status: 206, headers });
    }
    headers["Content-Length"] = blob.size;
    return new Response(blob, { headers });
  }

  // 42.sw.js
  var self2 = (
    /** @type {ServiceWorkerGlobalScope} */
    /** @type {unknown} */
    globalThis.self
  );
  var MAX_CACHE_SIZE = 1.5 * 1024 ** 2;
  var db2;
  var state;
  var fileIndex3;
  var debug2 = 1;
  var d = debug2 ? (...args) => console.debug(t(), ...args) : () => {
  };
  var dd = debug2 > 1 ? (...args) => console.debug(t(), ...args) : () => {
  };
  function t(date) {
    if (!date) date = /* @__PURE__ */ new Date();
    else if (typeof date === "number") date = new Date(date);
    return `${date.toLocaleTimeString("zh-CN")}`;
  }
  async function getFileIndex() {
    if (fileIndex3) return;
    db2 ??= new Database({ name: "fileindex" });
    const res = await db2.store.get("value").catch((err) => {
      d("\u{1F6F0}\uFE0F\u{1F4A5} database error", err);
    });
    if (res) {
      fileIndex3 ??= new FileIndex();
      fileIndex3.value = res;
      state = "handshake-completed";
      d("\u{1F6F0}\uFE0F fileindex synced");
    } else {
      d("\u{1F6F0}\uFE0F\u{1F4A5} fileindex empty");
    }
  }
  ipc.on("42_SW_HANDSHAKE", () => getFileIndex()).on("42_SW_WAKE", async () => {
    await getFileIndex();
    d("\u{1F6F0}\uFE0F wake");
  }).on("42_FILEINDEX_CHANGE", async (filename, mode, inode) => {
    try {
      await fileIndex3?.[mode](filename, inode);
    } catch (err) {
      d(`\u{1F6F0}\uFE0F\u{1F4A5} 42_FILEINDEX_CHANGE error`, err);
    }
  });
  self2.addEventListener("message", (e) => {
    if (e.data?.type === "42_SW_CLAIM") e.waitUntil(self2.clients.claim());
  });
  self2.addEventListener("install", () => {
    d("\u{1F6F0}\uFE0F install");
    state = "install";
    self2.skipWaiting();
  });
  self2.addEventListener("activate", (e) => {
    d("\u{1F6F0}\uFE0F activate");
    state = "activate";
    e.waitUntil(caches.delete("fetched").then(() => self2.clients.claim()));
  });
  var REQUEST_INIT_KEYS = [
    "cache",
    "credentials",
    "headers",
    "integrity",
    "keepalive",
    "method",
    "mode",
    "priority",
    "redirect",
    "referrer",
    "referrerPolicy",
    "signal"
  ];
  async function cloneRequest(url, request2, requestInit = {}) {
    if (!requestInit.body) {
      let body;
      if (request2.headers.get("Content-Type")) body = await request2.blob();
      requestInit.body = body;
    }
    for (const key of REQUEST_INIT_KEYS) requestInit[key] ??= request2[key];
    return new Request(url, requestInit);
  }
  async function fromCacheOrNetwork(req, pathname, forcePathname) {
    let res = await caches.match(pathname);
    if (res) return res;
    if (forcePathname) req = await cloneRequest(pathname, req);
    res = await pageAssetResponse(pathname, req);
    res ??= req.destination === "iframe" ? await fetch(req, {
      credentials: "same-origin",
      headers: {
        "Sec-Fetch-Dest": req.destination,
        "X-Sec-Fetch-Dest": req.destination
      }
    }) : await fetch(req, { credentials: "same-origin" });
    if (res.ok && res.status !== 206 && req.method === "GET" && pathname !== "/42.tar.gz" && !pathname.startsWith("/42_DEV") && Number(res.headers.get("Content-Length")) < MAX_CACHE_SIZE) {
      const clone = res.clone();
      caches.open("fetched").then((cache) => cache.put(pathname, clone));
    }
    return res;
  }
  var handshakeRequestPromise;
  self2.addEventListener("fetch", (e) => {
    const req = e.request;
    let { origin, pathname, searchParams } = new URL(req.url);
    if (origin !== location.origin || searchParams.has("original") && navigator.onLine || pathname.startsWith("/shop")) {
      return;
    }
    try {
      pathname = decodeURI(pathname);
    } catch {
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    if ((pathname === "/index.html" || pathname === "/42.system.js") && navigator.onLine) {
      return;
    }
    e.respondWith(
      (async () => {
        if (!fileIndex3) {
          dd(`\u{1F6F0}\uFE0F state: ${state}`);
          if (state) return fromCacheOrNetwork(req, pathname);
          handshakeRequestPromise ??= getFileIndex();
          await handshakeRequestPromise;
          if (!fileIndex3) {
            state = "handshake-failed";
            d("\u{1F6F0}\uFE0F handshake failed");
            return fromCacheOrNetwork(req, pathname);
          }
        }
        handshakeRequestPromise = void 0;
        let inode = fileIndex3.get(pathname);
        if (!inode) return fromCacheOrNetwork(req, pathname);
        if (typeof inode === "string") {
          pathname = inode;
          if (pathname.startsWith("http://") || pathname.startsWith("https://") || pathname.startsWith("//")) {
            return fromCacheOrNetwork(req, pathname, true);
          }
          inode = fileIndex3.get(pathname);
          if (!inode) return fromCacheOrNetwork(req, pathname, true);
        }
        const { headers } = getPathInfo(pathname, {
          headers: {
            "Accept-Ranges": "bytes",
            // [1]
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "credentialless"
          }
        });
        try {
          const driver6 = await getDriver(inode[1]);
          const blob = await driver6.open(pathname);
          headers["Content-Length"] = blob.size;
          return new Response(blob, { headers });
        } catch (err) {
          const status = err.errno === 2 ? 404 : 500;
          return new Response(err, { headers, status });
        }
      })()
    );
  });
  self2.addEventListener("error", (e) => {
    d("\u{1F6F0}\uFE0F\u{1F4A5} error", e);
  });
  self2.addEventListener("unhandledrejection", (e) => {
    d("\u{1F6F0}\uFE0F\u{1F4A5} unhandled rejection", e);
  });
})();
//! Copyright (c) 2014-2017, Sindre Sorhus. MIT License.
//! Copyright (c) 2014-2017, Jon Schlinkert. MIT License.
//! Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
//! Copyright the Browserify authors. MIT License.
//! Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
//! Copyright (c) 2014 Jameson Little. MIT License.
/**
 * @file
 * @author Jameson Little
 * @license MIT
 * @source https://github.com/beatgammit/base64-js
 */
