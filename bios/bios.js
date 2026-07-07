// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { trap } from "../42/api/trap.js?original"

const VERSION = "3.1.3"

function removeBoot() {
  document.querySelector("output#boot")?.remove()
  document.querySelector("#bootStyles")?.remove()
}

window.sys42 ??= {}
window.sys42.bios ??= {}
window.sys42.bios.done = false
window.sys42.bios.errors = []
window.sys42.desktop ??= {}
window.sys42.desktop.done = false
window.sys42.desktop.removeBoot = async (options) => {
  const { systemSounds } = await import("../42/api/os/systemSounds.js")
  removeBoot()
  systemSounds(options)
}
window.sys42.desktop.loaded = async () =>
  window.sys42.desktop.removeBoot({ skipStartupSound: true })

const { bios } = window.sys42

bios.el = document.querySelector("#boot")

const biosEl = bios.el

function span(text) {
  const span = document.createElement("span")
  span.append(text)
  return span
}

function log(...args) {
  biosEl.append(...args.map((x) => (typeof x === "string" ? span(x) : x)))
  biosEl.scrollTop = biosEl.scrollHeight
}

bios.handleError = async () => {
  bios.controller.abort()
  const { resetAllData } = await import(
    "../42/lib/browser/resetAllData.js?original"
  )
  await resetAllData()
  location.href = "/"
}

bios.traceHeader = () => {
  const header = document.querySelector("#boot-header")
  if (header?.childNodes.length === 0) {
    header.append(`${navigator.userAgent}\n${new Date().toUTCString()}\n\n`)
  }
}

bios.traceError = async (err) => {
  let errorContent
  try {
    const { displayError } = await import("../42/api/log/displayError.js")
    errorContent = displayError(err)
  } catch {
    errorContent = err.stack
  }

  bios.traceHeader()

  const span = document.createElement("span")
  span.classList = "ansi-red"
  span.append("--- FATAL ERROR ---\n", errorContent)
  bios.el.append(span)

  const notice = document.createElement("span")
  notice.className = "report-notice"
  notice.textContent = "\nCLICK SCREEN OR PRESS ANY KEY TO RESET ALL DATA"
  bios.el.append(notice)
  bios.el.scrollTop = bios.el.scrollHeight

  bios.controller = new AbortController()
  const { signal } = bios.controller
  const { handleError } = bios
  document.addEventListener("pointerdown", handleError, { signal })
  document.addEventListener("keydown", handleError, { signal })
}

bios.forgetTrap = trap((err, { label, reports }) => {
  if (reports) {
    console.group(label)
    console.log(reports)
    console.groupEnd()
  }

  if (bios.done === false) {
    if (bios.errors.length === 0) bios.traceError(err)
    bios.errors.push(err)
    console.log(err)
  }

  bios.controller?.abort()

  return false
})

/* eslint-disable import/no-unresolved */
if (window.NO_DYNAMIC_MODULES !== true) {
  window.name = "desktop"

  let version = localStorage.getItem("sys42_version")
  localStorage.setItem("sys42_version", VERSION)

  let isReloaded = window.performance
    .getEntriesByType("navigation")
    .map((nav) => nav.type)
    .includes("reload")

  const splash = !location.search.includes("no-splash")
  const reset = location.search.includes("reset-data")
  const unregistered = location.search.includes("unregistered")

  if (unregistered) {
    isReloaded = false
    const path = reset ? "/?reset-data" : "/"
    window.history.replaceState({}, "", path)
  } else if (reset) {
    isReloaded = false
    const { resetAllData } = await import(
      "../42/lib/browser/resetAllData.js?original"
    )
    const [registrations] = await resetAllData()
    for (const [ok, reg] of registrations) {
      if (ok && reg.active) location.href = "/?reset-data&unregistered"
    }
  }

  if (isReloaded && (await caches.keys()).length === 0) isReloaded = false

  // Preload user config and check timestamps
  try {
    const [{ ConfigFile }, { serverTimestamps }] = await Promise.all([
      import("../42/api/os/ConfigFile.js"),
      fetch("/timestamps.json?original")
        .then((res) => res.json())
        .then((json) => ({ serverTimestamps: json }))
        .catch(() => ({ serverTimestamps: null })),
      import("../42/api/fileIndex.js"),
    ])

    let localTimestamps = {}
    try {
      const stored = localStorage.getItem("sys42_timestamps")
      if (stored) {
        if (!version) version = "3.0.0"
        localTimestamps = JSON.parse(stored)
      } else {
        version = VERSION
      }
    } catch {}

    const usersConfig = new ConfigFile("/users.json5", {
      activeUser: "windows93",
      users: ["windows93"],
    })
    await usersConfig.init()

    window.sys42 ??= {}
    window.sys42.env ??= {}
    window.sys42.env.USER = usersConfig.value.activeUser
    window.sys42.env.VERSION = version

    let fileIndex

    if (serverTimestamps) {
      const upgrades = []
      for (const key of Object.keys(serverTimestamps)) {
        if (key === "/c/users/windows93") continue
        if (
          localTimestamps[key] !== undefined &&
          serverTimestamps[key] > localTimestamps[key]
        ) {
          console.log(`--- upgrade ${key} ---`)
          upgrades.push(key)
        }
      }

      if (upgrades.length > 0) {
        log(`Upgrade in progress: ${upgrades.join(", ")}\n`)
        fileIndex ??= await import("../42/api/fileIndex.js") //
          .then((m) => m.fileIndex)
        await fileIndex.upgrade(upgrades)
      }

      let rootUserTimestamp = localStorage.getItem("sys42_rootuser_timestamp")
      if (rootUserTimestamp !== null) {
        try {
          rootUserTimestamp = JSON.parse(rootUserTimestamp)
        } catch {}
      } else if (localTimestamps["/c/users/windows93"] !== undefined) {
        rootUserTimestamp = localTimestamps["/c/users/windows93"]
      }

      const rootUserServerTimestamp = serverTimestamps["/c/users/windows93"]
      delete serverTimestamps["/c/users/windows93"]

      if (rootUserTimestamp != null) {
        if (
          rootUserServerTimestamp !== undefined &&
          rootUserServerTimestamp > rootUserTimestamp
        ) {
          if (usersConfig.value.activeUser === "windows93") {
            window.sys42.needsRootUserClaim = true
          }
        } else if (rootUserServerTimestamp !== undefined) {
          localStorage.setItem(
            "sys42_rootuser_timestamp",
            JSON.stringify(rootUserServerTimestamp),
          )
        }
      } else if (rootUserServerTimestamp !== undefined) {
        localStorage.setItem(
          "sys42_rootuser_timestamp",
          JSON.stringify(rootUserServerTimestamp),
        )
      }

      localStorage.setItem("sys42_timestamps", JSON.stringify(serverTimestamps))
    }
  } catch (err) {
    console.warn("Failed to preload user config or timestamps", err)
  }

  if (window.sys42.env.USER === undefined) {
    if (isReloaded) window.sys42.bios.el.className = "reload"
    const { client } = await import("../42/api/os/network/client.js")
    await client.connect()
    const { usersManager } = await import(
      "../42/api/os/managers/usersManager.js"
    )
    removeBoot()
    usersManager.chooseUserDialog()
  } else if (isReloaded) {
    window.sys42.bios.el.className = "reload"
    const { client } = await import("../42/api/os/network/client.js")
    await client.connect()
    import("../desktop.js")
  } else {
    log(`Version: ${version}\n`)
    const { boot } = await import("../bios/boot.js?original")
    boot({ splash })
  }
}
