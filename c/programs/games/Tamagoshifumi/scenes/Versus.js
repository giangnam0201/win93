import { div, button } from "../js/html.js"

export default class Versus extends Phaser.Scene {
  constructor() {
    super({ key: "Versus" })
  }

  preload() {}

  create() {
    this.cameras.main.height = game.canvas.height
    this.cameras.main.width = game.canvas.width
    this.stage = new $.Stage(
      this,
      rival.boss ? "boss" : $.characters[rival.main].stage,
    )
    this.p1 = new $.Character(this, player.main, { auto: !false })
    this.p2 = new $.Character(this, rival.main, {
      auto: !false,
      mirror: true,
      boss: rival.boss,
    })

    player.hp = player.life

    this.p1.lover = player.lover
    this.p2.lover = rival.lover

    this.p1.rival = this.p2
    this.p2.rival = this.p1

    this.hud = new $.HUD(this)
    this.inputs = new $.Inputs(this)
    this.time.delayedCall(200, () => this.hud.in(true))

    this.shutter = new $.Shutter(this)
    this.shutter.open(100)

    app.once("change", () => ($.quit = true))

    const update = () =>
      board.update(
        div({ class: "board__buttons arena" }, [
          moveBtn("attack"),
          moveBtn("block"),
          moveBtn("grab"),
        ]),
      )

    const moveBtn = (type) => {
      const el = [
        button({ class: `inputs ${type}` }, div({ class: "picto" }), () =>
          action(type),
        ),
      ]
      if (player.deck.has("train") && player.moves.main.super.type === type) {
        el.push(
          button(
            { class: `inputs super picto_${player.moves.main.super.inputs}` },
            div({ class: "picto" }),
            () => action("super"),
          ),
        )
      }
      if (player.deck.has("love") && player.moves.lover.super.type === type) {
        el.push(
          button(
            { class: `inputs lover picto_${player.moves.lover.super.inputs}` },
            div({ class: "picto" }),
            () => action("lover"),
          ),
        )
      }
      return div(el)
    }

    const end = (win, text, fx, go) => {
      $.fx(this, fx)

      $.sepia.in(this.stage, this.p1, this.p2, false)

      this.cameras.main.flash(600)
      $.music.fadeOut(this, 300)
      this.time.delayedCall(400, () => this.hud.out())

      this.time.delayedCall(1200, () => {
        new $.Waifu(this, text, { close: true })
        this.time.delayedCall(1000, () => {
          this.shutter.close(200, () => {
            this.time.delayedCall(400, () => {
              $.sepia.out(this.stage, this.p1, this.p2)
              go(this)
            })
          })
        })
      })
    }

    const win = () => end(true, "you_win", "blam", $.win)
    const lose = () => end(false, "you_lose", "bom", $.lose)

    const bts = (cb) => {
      this.time.delayedCall(1400, () => {
        this.bts.in((score) => {
          const rivalscore = $.bts(score)
          const btsWinner = score > rivalscore ? 1 : 2
          this.inputs.in(btsWinner, score, rivalscore)
          this.time.delayedCall(100, () => cb(btsWinner))
        })
      })
    }

    const check = (c, m1, m2) => {
      const winner = $.gameplay.round(c, m1, m2)

      const hop = () => {
        this.hud.update()
        if (winner === 1) win()
        else if (winner === 2) lose()
        else update()
      }

      this.time.delayedCall(1400, () => {
        if (!rival.boss) $.sepia.out(this.stage, this.p1, this.p2)
        this.hud.in()
      })

      this.time.delayedCall(1800, () => {
        if (c === 1) this.p1.play(m1.move, undefined, hop)
        else if (c === 2) this.p2.play(m2.move, undefined, hop)
      })
    }

    const action = async (type1, type2) => {
      if (!rival.boss) $.sepia.in(this.stage, this.p1, this.p2)

      if (board.closed) return
      board.close()
      const m1 = player.move(type1)
      const m2 = rival.move(type2, type1)

      let c = $.gameplay.check(m1.type, m2.type)
      this.hud.out()
      this.inputs.in(c, m1, m2)

      if (m1.pooped && m2.pooped) c = 0
      else if (m1.pooped) c = 2
      else if (m2.pooped) c = 1

      if (c === 0) bts((c) => check(c, m1, m2))
      else check(c, m1, m2)
    }

    this.bts = new $.BTS(this)

    update()
  }
}
