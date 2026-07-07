import { div, /* pre, */ span, button } from "../js/html.js"

export default class Menu extends Phaser.Scene {
  constructor() {
    super({ key: "Menu" })
  }

  create() {
    this.cameras.main.height = game.canvas.height
    this.cameras.main.width = game.canvas.width
    $.music.stop()
    this.time.delayedCall(900, () => $.music(this, "gipsy"))

    board.update(
      div({ class: "board__buttons menu" }, [
        player &&
          player.main &&
          button(span("CONTINUE?"), () => {
            player.fresh()
            $.newGame(this)
          }),
        button(
          span("NEW GAME" + (player && player.unlocked.length > 0 ? "+" : "")),
          () => {
            if (!player) player = new player(game)
            player.reset()
            $.newGame(this)
          },
        ),
        // pre(
        //   { style: { background: "#000", textAlign: "left" } },
        //   JSON.stringify(game.device, false, 2)
        // ),
        $.dev &&
          button(span("*** DEV ***"), { style: { opacity: 0.5 } }, () =>
            board.update(
              div(
                { class: "board__buttons dev" },
                Object.entries($.dev).map(([key, val]) => button(key, val)),
              ),
            ),
          ),
      ]),
    )

    const display = () => {
      this.cameras.main.resetFX()
      this.cameras.main.fadeIn(1100, 255, 255, 255)
      const s = Phaser.Utils.Array.GetRandom($.SPLASH_STAGES)
      new $.Stage(this, s, true)

      this.time.delayedCall(1400, () => {
        const a = this.add.image(55, 30, "tamagoshifumi")
        a.scaleY = 0
        this.tweens.add({
          targets: a,
          scaleY: 1,
          duration: 800,
        })
        this.time.delayedCall(2000, () => {
          const subtitle = this.add.image(55, 48, "subtitle")

          this.time.addEvent({
            delay: 800,
            callback: () => {
              subtitle.visible = !subtitle.visible
            },
            callbackScope: this,
            loop: true,
          })

          this.time.delayedCall(11500, () => {
            this.cameras.main
              .fadeOut(2000, 0, 0, 0)
              .once("camerafadeoutcomplete", reboot)
          })
        })
      })
    }

    const tada = () => {
      this.cameras.main
        .fadeOut(500, 255, 255, 255)
        .once("camerafadeoutcomplete", display)
    }

    const reboot = () => {
      this.children.removeAll()
      this.time.delayedCall(600, arcade)
    }

    app.log("menu")
    const arcade = () => {
      app.log("arcade")
      this.cameras.main.resetFX()
      this.time.delayedCall(900, () => {
        const a = this.add.image(55, 30, "stunfest")
        a.scaleX = 0
        const b = this.add.image(55, 30, "win93")
        b.scaleY = 0

        const text = this.add.text(55, 30, "", { font: "8px pico" })
        text.setOrigin(0.5)

        this.tweens.timeline({
          ease: "Power2",
          duration: 300,
          onComplete: tada,
          tweens: [
            {
              targets: a,
              scaleX: 1,
              hold: 1000,
            },
            {
              targets: a,
              scaleY: 0,
              hold: 500,
            },

            {
              targets: a,
              scaleY: 0,
              onStart: () => text.setText("AND"),
              hold: 1100,
            },
            {
              targets: a,
              scaleY: 0,
              onStart: () => text.setText(""),
              hold: 400,
            },

            {
              targets: b,
              scaleY: 1,
              hold: 1000,
            },
            {
              targets: b,
              scaleY: 0,
              hold: 500,
            },

            {
              targets: a,
              scaleY: 0,
              onStart: () => text.setText("PRESENT"),
              hold: 1100,
            },
            {
              targets: a,
              scaleY: 0,
              onStart: () => text.setText(""),
              hold: 700,
            },
          ],
        })
      })
    }

    arcade()
  }
}
