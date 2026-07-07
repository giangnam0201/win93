import { inAutomated } from "../../env/runtime/inAutomated.js"

const { serviceWorker } = navigator

export async function unregisterServiceWorker() {
  return serviceWorker.getRegistrations().then(async (regs) => {
    const res = await Promise.all(regs.map((reg) => reg.unregister()))
    if (res.length > 0 && res.every(Boolean)) {
      return true
    }
  })
}

function t(date) {
  if (!date) date = new Date()
  else if (typeof date === "number") date = new Date(date)
  return `${date.toLocaleTimeString("zh-CN")}`
}

// const skipServiceWorker = location.hostname === "localhost"
const skipServiceWorker = false

class Client {
  get controller() {
    return serviceWorker.controller
  }

  async connect(options) {
    if (skipServiceWorker || inAutomated) return
    if (typeof options === "string") options = { url: options }
    await this.register(options)
    if (options?.sync !== false) await this.sync()
  }

  async register(options) {
    if (skipServiceWorker || inAutomated) return

    const base = location.pathname.endsWith('/') ? location.pathname : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
    const moduleURL = new URL(
      options?.url ?? (base + "42.sw.js"), //
      location.origin,
    ).href
    const bundleURL = new URL(
      options?.bundleURL ?? (base + "42.sw.bundle.js"),
      location.origin,
    ).href

    if (this.registration) {
      for (const state of ["active", "installing", "waiting"]) {
        const scriptURL = this.registration[state]?.scriptURL
        if (scriptURL === moduleURL || scriptURL === bundleURL) return
      }
    }

    try {
      this.registration = await serviceWorker.register(moduleURL, {
        type: "module",
        updateViaCache: "none",
      })
    } catch {
      this.registration = await serviceWorker.register(bundleURL, {
        updateViaCache: "none",
      })
    }

    if (this.registration) {
      this.registration.addEventListener("updatefound", () => {
        console.debug(t(), "📡 service worker update found")
      })
    }

    if (!this.controller) {
      if (this.registration?.active) return // Hard refresh https://stackoverflow.com/a/62596701

      await new Promise((resolve) => {
        const handler = () => {
          if (this.controller) {
            serviceWorker.removeEventListener("controllerchange", handler)
            resolve()
          }
        }
        serviceWorker.addEventListener("controllerchange", handler)
      })
    }
  }

  async wake() {
    if (!this.controller) return
    const { ipc } = await import("../../ipc.js")
    await ipc.bus(this.controller).ask("42_SW_WAKE")
  }

  synced = false
  async sync() {
    if (this.synced) return
    this.synced = true

    const [{ ipc }, { fileIndex }] = await Promise.all([
      import("../../ipc.js"),
      import("../../fileIndex.js"),
    ])

    const handshake = () => {
      console.debug(t(), "📡 service worker handshake")
      this.bus?.destroy()
      if (this.controller) {
        this.controller.onstatechange = (e) => {
          const sw = /** @type {ServiceWorker} */ (e.target)
          console.debug(t(), `📡 service worker state: (${sw.state})`)
        }
        this.bus = ipc.bus(this.controller)
        this.bus.emit("42_SW_HANDSHAKE")
      }
    }

    handshake()
    serviceWorker.addEventListener("controllerchange", handshake)

    fileIndex.on("change", (filename, mode, inode) => {
      this.bus?.emit("42_FILEINDEX_CHANGE", filename, mode, inode)
    })

    if (
      navigator.onLine &&
      location.host.startsWith("localhost") &&
      !globalThis.dev
    ) {
      // @ts-ignore
      import("/42_DEV/dev.js").catch(() => {})
    }
  }
}

export const client = new Client()
