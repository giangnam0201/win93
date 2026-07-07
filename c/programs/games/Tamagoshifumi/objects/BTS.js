import { div, button } from "../js/html.js"
import throttle from "../js/throttle.js"

export default class BTS {
  constructor(scene) {
    this.scene = scene

    this.scene.anims.create({
      key: "ready",
      frames: [{ key: "bts1" }, { key: "bts2" }],
      frameRate: 30,
      repeat: -1,
    })

    this.ready = this.scene.add.sprite(55, -30, "bts1")

    this.ready.depth = 2000
    this.ready.visible = false

    this.score = this.scene.add.bitmapText(0, 0, "hajime", "0", 8)
    this.score.visible = false
    this.score.depth = 2001
    this.score.tint = 0x00ff00
  }

  update() {}

  in(cb) {
    this.score.x = 55 - this.score.width / 2
    this.score.y = 24
    this.score.visible = false

    let cnt = 0
    const tt = throttle(() => {
      this.scene.cameras.main.flash(50, 0.05, 0.05, 0.05)
      this.scene.cameras.main.shake(60, 0.01)
      this.score.visible = true
      this.score.setText(cnt)
      this.score.x = 55 - this.score.width / 2
      $.vibrate()
    })
    const btn = button({
      class: "arcade_btn",
      // ontouchstart: e => {
      onpointerdown: (e) => {
        e.preventDefault()
        cnt++
        tt()
        btn.className = "arcade_btn active"
      },
      // ontouchend: e => {
      onpointerup: (e) => {
        e.preventDefault()
        btn.className = "arcade_btn"
      },
    })

    let back

    const open = () => {
      back = board.temp([
        div({ class: "board__buttons board__buttons--arcade" }, btn),
      ])
    }

    if (board.closedDoors) open()
    else board.close().once("close", open)

    this.ready.visible = true
    this.ready.play("ready")

    const go = () => {
      board.open()
      this.scene.time.delayedCall(3000, () => {
        board.close().once("close", () => {
          back()
          this.scene.tweens.add({
            targets: this.score,
            y: -20,
            ease: "Cubic.easeOut",
            duration: 300,
          })
          cb(cnt)
        })
      })
    }

    this.scene.tweens.timeline({
      targets: this.ready,
      tweens: [
        {
          ease: "Back.easeOut",
          y: 30,
          duration: 500,
          hold: 300,
        },
        {
          ease: "Cubic.easeIn",
          y: 100,
          duration: 400,
          onComplete: go,
        },
      ],
    })
  }
}
