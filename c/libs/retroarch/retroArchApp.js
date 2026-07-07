import { RetroArch } from "./RetroArch.js"
import { createEmulatorApp } from "../../../42/api/os/EmulatorApp.js"

createEmulatorApp({
  load: (rom, app) =>
    new RetroArch(app, {
      signal: app.signal,
      shell: app.shell,
      name: app.name,
      ...app.config,
      rom,
    }),
})
