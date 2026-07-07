import { div, button, img } from "../js/html.js"

const KEYS = {
  age: 47,
  job: 47,
  country: 63,
  blood: 53,
  hobby: 55,
}

export default class Select extends Phaser.Scene {
  constructor() {
    super({ key: "Select" })
  }

  create(type) {
    this.cameras.main.height = game.canvas.height
    this.cameras.main.width = game.canvas.width
    if (type === "character") $.music(this, "ragga")
    this.bg = new $.BG(this, type === "character" ? "pattern" : "pattern_love")

    const isLover = type === "partner"
    const avatars = []
    const unlocked = ["shoto", "eva", "kent", "tyfenn"].concat(player.unlocked)
    let choice = player[isLover ? "lover" : "main"]
    let selected = false
    let okBtn

    const waifu = new $.Waifu(this, `choose_your_${type}`)

    const display = async (name = choice) => {
      waifu.open(`perso_${name}`)
      waifu.image.y = 12

      $.vibrate()

      const character = $.characters[name]

      if (selected === false) {
        okBtn.disabled = false
        let cc = 0
        Object.entries(KEYS).forEach(([key, val]) => {
          this.add
            .text(31, 20 + cc, `${Phaser.Utils.String.UppercaseFirst(key)}:`, {
              font: "8px pico",
            })
            .setShadow(1, 1, "rgba(0,0,0,0.3)", 0)
          this[key] = this.add.text(val, 20 + cc, "", {
            font: "8px pico",
            color: "#0f0",
          })
          this[key].setShadow(1, 1, "rgba(0,0,0,0.3)", 0)
          cc += 6
        })
      }

      selected = true

      Object.entries(character.infos).forEach(([key, val]) => {
        this[key].setText(val)
      })

      if (this.char) this.char.sprite.destroy()
      this.char = new $.Character(this, name, { auto: false })
      this.char.play("idle")

      const X = {
        marco: -29,
        queen: -23,
        utf8: -27,
        eva: -24,
      }
      this.char.sprite.x = name in X ? X[name] : -26
    }

    function char(name) {
      if (!unlocked.includes(name)) return myst()
      const disabled = isLover && name === player.main
      const el = div(
        {
          class: `avatar${disabled ? " disabled" : ""}`,
          onclick() {
            if (!disabled && name in $.characters) {
              avatars.forEach((avatar) => avatar.classList.remove("selected"))
              el.classList.add("selected")
              choice = name
              display(name)
            }
          },
        },
        img(`./assets/sprites/avatars/${name}.png`),
      )
      avatars.push(el)
      return el
    }

    const myst = () =>
      div({ class: "avatar" }, img("./assets/sprites/ui/mysterious.png"))

    board.update([
      div(
        { class: "board__buttons character_select" },
        div([char("shoto"), char("marco"), char("tyfenn")]),
        div([
          char("utf8"),
          div(
            { class: "btn_cont" },
            (okBtn = button(
              {
                disabled: !selected,
                onclick: () => {
                  $.vibrate()
                  player[isLover ? "lover" : "main"] = choice
                  board.close()
                  waifu.say("ok")
                  this.time.delayedCall(100, () => {
                    if (isLover) {
                      // shutter
                      $.start(this)
                    } else {
                      $.go(this, "Select", "partner")
                    }
                  })
                },
              },
              img(`./assets/images/icons/${isLover ? "love" : "tick"}.png`),
            )),
          ),
          char("queen"),
        ]),
        div([char("kent"), char("kuno"), char("eva")]),
      ),
    ])
  }

  update(t, dt) {
    this.bg.update(t, dt)
  }
}
