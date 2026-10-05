import "../../../../../42/ui/media/scope.js"
import { mixer } from "../../../../../42/lib/audio/mixer.js"

/**
 * @param {import("42/api/os/AudioApp.js").AudioApp} app
 */
export async function renderApp(app) {
  return {
    tag: "ui-scope.w-full",
    mode: app.config.mode ?? "auto",
    autoScale: app.config.autoScale ?? true,
    created(el) {
      el.audioContext = mixer.context
      app.audioPipe = el.audioPipe
    },
  }
}
