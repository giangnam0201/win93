import { div, span, button, img } from "../js/html.js"

export default class Home extends Phaser.Scene {
  constructor() {
    super({ key: "Home" })
  }

  create() {
    this.cameras.main.height = game.canvas.height
    this.cameras.main.width = game.canvas.width
    const deckList = []
    const pooList = []

    const renderDeck = () => {
      pooList.forEach((sprite) => sprite.destroy())
      deckList.forEach((sprite) => sprite.destroy())
      player.deck.forEach((name, i) => {
        deckList.push(this.add.image(41 + i * 16, 15, name))
      })
      for (let i = 0; i < player.poo; i++) {
        pooList.push(this.add.image(10 + i * 5, 10, "poo"))
      }
    }

    const divOpt = { class: "btn_cont" }

    board.update([
      div(
        { class: "board__buttons day_off" },
        div([
          span(img()),
          div(
            divOpt,
            button(
              { disabled: player.prog[player.win] === player.lover },
              img("./assets/images/icons/love.png"),
              () => action("love"),
            ),
          ),
          span(img()),
        ]),
        div([
          div(
            divOpt,
            button(img("./assets/images/icons/food.png"), () => action("food")),
          ),
          div(
            divOpt,
            button(img("./assets/images/icons/wc.png"), () => action("wc")),
          ),
          div(
            divOpt,
            button(img("./assets/images/icons/drink.png"), () =>
              action("drink"),
            ),
          ),
        ]),
        div([
          span(img()),
          div(
            divOpt,
            button(img("./assets/images/icons/train.png"), () =>
              action("train"),
            ),
          ),
          span(img()),
        ]),
      ),
    ])

    new $.Stage(this, "home")
    const char = new $.Character(this, player.main, { auto: false })
    char.sprite.y = 2
    char.sprite.x = 14 + (player.main === "marco" ? -3 : 0)
    char.play("idle")

    const action = (type) => {
      if (board.closed) return
      $.vibrate()

      this.cameras.main.flash(50)

      if (type === "wc") {
        player.poo = 0
      } else if (type === "food" || type === "drink") {
        player.poo++
      }

      player.deck.push(type)

      renderDeck()

      if (player.deck.length === 3) {
        board.close()

        $.music.fadeOut(this, 400)
        this.time.delayedCall(100, () => {
          $.Waifu.say(this, "ok")
          this.time.delayedCall(300, () => {
            $.go(this, "Ready")
          })
        })
      }
    }
  }
}
