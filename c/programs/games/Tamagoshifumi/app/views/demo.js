/* eslint-disable no-invalid-this */
import { div, h2, button, select, option } from "../../js/html.js"

export default async () => {
  app.screen = div({ id: "screen" })
  if (game.isBooted) {
    app.screen.appendChild(game.canvas)
  } else {
    game.events.on("ready", () => {
      app.screen.appendChild(game.canvas)
    })
  }
  const el = [app.screen, div({ class: "separator" }), boardDemo]
  $.menu()

  function go() {
    window.clean()
    player.reset()
    rival.reset()
    player.main = player1.value
    // rival.main = player2.value;
    rival = new gameplay.Rival(game, player.prog[player.win])
  }
  function selectChar1() {
    go()
    $.go(game, "Versus")
  }
  function selectChar2() {
    go()
    $.go(game, "Versus")
  }

  let player1
  let player2

  boardDemo.update([
    div({ class: "board__buttons" }, [
      div([
        h2("player 1"),
        (player1 = select(
          { onchange: selectChar1 },
          $.CHARS.map((x) => option(x)),
        )),
        button(
          {
            onclick: () => {
              const x = player.move("super")
              console.log(111, x)
            },
          },
          "super",
        ),
      ]),
      div([
        h2("player 2"),
        (player2 = select(
          { onchange: selectChar2 },
          $.CHARS.map((x) => option(x)),
        )),
      ]),
      div([
        h2("Scenes"),
        button(() => {
          go()
          $.go(game, "Versus")
        }, "Versus"),
        button(() => {
          go()
          $.go(game, "Ready")
        }, "Ready"),
      ]),
    ]),
  ])

  boardDemo.open()

  // console.log();

  // window.clean();
  // player.random();
  $.initRival()
  // window.rival = new gameplay.Rival(game, "utf8");
  // $.go(game, "Versus");

  // setTimeout(() => {
  //   $.go(game, "Ready");
  // }, 0);

  return el
}
