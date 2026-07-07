import { div } from "../../js/html.js"

export default async () => {
  app.screen = div({ id: "screen" })
  if (game.isBooted) {
    app.screen.appendChild(game.canvas)
  } else {
    game.events.on("ready", () => {
      app.screen.appendChild(game.canvas)
    })
  }
  const el = [app.screen, div({ class: "separator" }), board]
  $.menu()
  return el
}
