import Character from "../objects/Character.js"
import BG from "../objects/BG.js"
import Stage from "../objects/Stage.js"
import Waifu from "../objects/Waifu.js"
import HUD from "../objects/HUD.js"
import Inputs from "../objects/Inputs.js"
import BTS from "../objects/BTS.js"
import Shutter from "../objects/Shutter.js"

export default class Splash extends Phaser.Scene {
  constructor() {
    super({ key: "Splash", autoload: false })

    $.Character = Character
    $.BG = BG
    $.Stage = Stage
    $.HUD = HUD
    $.Inputs = Inputs
    $.Waifu = Waifu
    $.BTS = BTS
    $.Shutter = Shutter

    $.sepia = {
      in: (stage, p1, p2, color) => {
        if (stage) {
          stage.pause()
          stage.sprite.setPipeline("Sepia")
          stage.sprite.scaleX = game.config.resolution
          stage.sprite.scaleY = game.config.resolution
        }
        if (p1) {
          if (color !== false) {
            p1.sprite.setPipeline("Black")
            p1.sprite.scaleX = game.config.resolution
            p1.sprite.scaleY = game.config.resolution
          }
          p1.pause()
        }
        if (p2) {
          if (color !== false) {
            p2.sprite.setPipeline("Black")
            p2.sprite.scaleX = -game.config.resolution
            p2.sprite.scaleY = game.config.resolution
            p2.sprite.x = game.canvas.width
          }
          p2.pause()
        }
      },
      out: (stage, p1, p2) => {
        if (stage) {
          stage.resume()
          stage.sprite.resetPipeline()
          stage.sprite.scaleX = 1
          stage.sprite.scaleY = 1
        }
        if (p1) {
          p1.sprite.resetPipeline()
          p1.sprite.scaleX = 1
          p1.sprite.scaleY = 1
          p1.resume()
        }
        if (p2) {
          p2.sprite.resetPipeline()
          p2.sprite.scaleX = -1
          p2.sprite.scaleY = 1
          p2.sprite.x = 111
          p2.resume()
        }
      },
    }

    $.sleep = (wait) => new Promise((resolve) => setTimeout(resolve, wait))
    $.vibrate = () => {
      // if (window._vibrate) {
      //   window.navigator.vibrate = window._vibrate;
      //   window.navigator.vibrate(delay);
      // }
    }

    const getSound = (scene, key) =>
      scene.sound.sounds.find((item) => item.key === key) ||
      scene.sound.add(key)

    $.fx = (scene, key) => {
      try {
        const fx = getSound(scene, key)
        fx.volume = 0.6
        fx.play()
      } catch (err) {
        if (window.dev) console.log(err)
      }
    }

    $.music = (scene, key) => {
      try {
        if ($.music.current) $.music.current.stop()
        $.music.scene = scene
        $.music.current = getSound(scene, key)
        app.log("$.music.current", $.music.current)
        app.log("$.music.current.key", $.music.current.key)
        $.music.current.volume = 1
        $.music.current.loop = true
        $.music.current.play()
      } catch (err) {
        if (window.dev) console.log(err)
      }
      return $.music
    }

    $.music.stop = () => {
      if ($.music.current) $.music.current.stop()
    }

    $.music.fadeOut = (scene, duration = 2000) => {
      if ($.music.current) {
        scene.tweens.add({
          targets: $.music.current,
          volume: 0,
          ease: "Linear",
          duration,
        })
      }
    }

    $.blend = (scene, key, type = "color", color = "#330088") => {
      const img = scene.textures.get(key).getSourceImage()
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = type
      ctx.fillStyle = color
      ctx.fillRect(0, 0, img.width, img.height)
      const newKey = `${key}_${type}_${color}`
      scene.textures.addCanvas(newKey, canvas)
      return newKey
    }
  }

  preload() {
    const bar = this.add.graphics()
    bar.fillStyle(0x222222, 1)
    bar.fillRect(10, 28, 91, 3)
    const progress = this.add.graphics()

    this.load.on("progress", (value) => {
      // app.log(value);
      progress.clear()
      progress.fillStyle(0x00ff00, 1)
      progress.fillRect(10, 28, 87 * value, 3)
    })

    this.load.on("complete", () => {
      // app.log("complete");
      progress.clear()
      progress.fillStyle(0x00ff00, 1)
      progress.fillRect(10, 28, 91, 3)
      setTimeout(() => {
        progress.destroy()
        bar.destroy()
        $.loaded = true
        game.events.emit("zou")
      }, 200)
    })

    this.load.audio("blam", [
      "sounds/kabuki/blam.mp3",
      "sounds/kabuki/blam.ogg",
    ])
    this.load.audio("bom", ["sounds/kabuki/bom.mp3", "sounds/kabuki/bom.ogg"])

    this.load.audio("kak", ["sounds/kabuki/kak.mp3", "sounds/kabuki/kak.ogg"])
    this.load.audio("tik", ["sounds/kabuki/tik.mp3", "sounds/kabuki/tik.ogg"])
    this.load.audio("chtouk", [
      "sounds/kabuki/chtouk.mp3",
      "sounds/kabuki/chtouk.ogg",
    ])
    this.load.audio("yiohou", [
      "sounds/kabuki/yiohou.mp3",
      "sounds/kabuki/yiohou.ogg",
    ])
    this.load.audio("riiyooho", [
      "sounds/kabuki/riiyooho.mp3",
      "sounds/kabuki/riiyooho.ogg",
    ])

    this.load.audio("gipsy", [
      "sounds/music/gipsy.mp3",
      "sounds/music/gipsy.ogg",
    ])
    this.load.audio("voot", ["sounds/music/voot.mp3", "sounds/music/voot.ogg"])
    this.load.audio("malade", [
      "sounds/music/malade.mp3",
      "sounds/music/malade.ogg",
    ])
    this.load.audio("ragga", [
      "sounds/music/ragga.mp3",
      "sounds/music/ragga.ogg",
    ])
    this.load.audio("end", ["sounds/music/end.mp3", "sounds/music/end.ogg"])

    this.load.audio("fart", ["sounds/fx/fart.mp3", "sounds/fx/fart.ogg"])
    this.load.audio("forward", [
      "sounds/fx/forward.mp3",
      "sounds/fx/forward.ogg",
    ])
    this.load.audio("laser", ["sounds/fx/laser.mp3", "sounds/fx/laser.ogg"])
    // this.load.audio("miaou", ["sounds/fx/miaou.mp3","sounds/fx/miaou.ogg"]);
    this.load.audio("ouich", ["sounds/fx/ouich.mp3", "sounds/fx/ouich.ogg"])
    this.load.audio("pim", ["sounds/fx/pim.mp3", "sounds/fx/pim.ogg"])
    this.load.audio("piouuu", ["sounds/fx/piouuu.mp3", "sounds/fx/piouuu.ogg"])
    this.load.audio("pouc2", ["sounds/fx/pouc2.mp3", "sounds/fx/pouc2.ogg"])
    this.load.audio("pouc", ["sounds/fx/pouc.mp3", "sounds/fx/pouc.ogg"])
    this.load.audio("reverse", [
      "sounds/fx/reverse.mp3",
      "sounds/fx/reverse.ogg",
    ])

    this.load.image("wc", "sprites/icons/wc.png")
    this.load.image("drink", "sprites/icons/drink.png")
    this.load.image("food", "sprites/icons/food.png")
    this.load.image("love", "sprites/icons/love.png")
    this.load.image("train", "sprites/icons/train.png")
    this.load.image("poo", "sprites/icons/poo.png")

    this.load.image("drink_8", "sprites/icons/drink_8.png")
    this.load.image("food_8", "sprites/icons/food_8.png")
    this.load.image("love_8", "sprites/icons/love_8.png")
    this.load.image("train_8", "sprites/icons/train_8.png")
    this.load.image("poo_8", "sprites/icons/poo_8.png")

    this.load.image("mysterious", "sprites/ui/mysterious.png")
    this.load.image("stunfest", "sprites/ui/stunfest.png")
    this.load.image("win93", "sprites/ui/win93.png")
    this.load.image("tamagoshifumi", "sprites/ui/tamagoshifumi.png")
    this.load.image("subtitle", "sprites/ui/subtitle.png")
    this.load.image("ko", "sprites/ui/ko.png")

    this.load.image("bts1", "sprites/ui/bts1.png")
    this.load.image("bts2", "sprites/ui/bts2.png")

    this.load.image("ban_win_1", "sprites/ui/ban_win_1.png")
    this.load.image("ban_lose_1", "sprites/ui/ban_lose_1.png")
    this.load.image("ban_eq_1", "sprites/ui/ban_eq_1.png")
    this.load.image("ban_win_2", "sprites/ui/ban_win_2.png")
    this.load.image("ban_lose_2", "sprites/ui/ban_lose_2.png")
    this.load.image("ban_eq_2", "sprites/ui/ban_eq_2.png")

    this.load.image("360_ROCK_2", "sprites/inputs/360_ROCK_2.png")
    this.load.image("360_ROCK", "sprites/inputs/360_ROCK.png")
    this.load.image("360_SCISSORS_2", "sprites/inputs/360_SCISSORS_2.png")
    this.load.image("360_SCISSORS", "sprites/inputs/360_SCISSORS.png")
    this.load.image("DP_PAPER_2", "sprites/inputs/DP_PAPER_2.png")
    this.load.image("DP_PAPER", "sprites/inputs/DP_PAPER.png")
    this.load.image("HCF_ROCK_2", "sprites/inputs/HCF_ROCK_2.png")
    this.load.image("HCF_ROCK", "sprites/inputs/HCF_ROCK.png")
    this.load.image("PAPER", "sprites/inputs/PAPER.png")
    this.load.image("QCF_PAPER_2", "sprites/inputs/QCF_PAPER_2.png")
    this.load.image("QCF_PAPER", "sprites/inputs/QCF_PAPER.png")
    this.load.image("QCF_ROCK_2", "sprites/inputs/QCF_ROCK_2.png")
    this.load.image("QCF_ROCK", "sprites/inputs/QCF_ROCK.png")
    this.load.image("ROCK", "sprites/inputs/ROCK.png")
    this.load.image("SCISSORS", "sprites/inputs/SCISSORS.png")
    this.load.image("POO", "sprites/inputs/POO.png")

    this.load.image("avatar_boss", "sprites/avatars/boss.png")

    this.load.bitmapFont("hajime", "fonts/hajime.png", "fonts/hajime.fnt")

    $.ENDINGS.forEach((item) =>
      this.load.image(`ending_${item}`, `sprites/z/${item}.png`),
    )

    $.CHARS.forEach((key) => {
      Character.preload(this, key)
      Stage.preload(this, $.characters[key].stage)
      this.load.image(`avatar_${key}`, `sprites/avatars/${key}.png`)
      this.load.image(
        `avatar_transp_${key}`,
        `sprites/avatars_transp/${key}.png`,
      )
    })

    Stage.preload(this, "home")
    Stage.preload(this, "boss")

    BG.preload(this)
    Waifu.preload(this)
  }
}
