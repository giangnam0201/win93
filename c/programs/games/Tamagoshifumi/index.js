import App from "./app/components/App.js"
import Board from "./app/components/Board.js"
import pipelines from "./app/pipelines.js"
import gameplay from "./app/gameplay.js"
import * as consts from "./app/consts.js"

import characters from "./assets/characters.js"
import { shuffle, rng } from "./js/chance.js"
import stats from "./js/stats.js"

import Splash from "./scenes/Splash.js"
import Menu from "./scenes/Menu.js"
import Select from "./scenes/Select.js"
import Solo from "./scenes/Solo.js"
import Home from "./scenes/Home.js"
import Ready from "./scenes/Ready.js"
import Versus from "./scenes/Versus.js"
import Ending from "./scenes/Ending.js"
import Credits from "./scenes/Credits.js"
import Blanck from "./scenes/Blanck.js"

// window.stats = stats;

window.dev = 0

document.addEventListener(
  window.cordova ? "deviceready" : "DOMContentLoaded",
  onDeviceReady,
  false,
)

function onDeviceReady() {
  const scene = [
    Splash,
    Menu,
    Select,
    Solo,
    Home,
    Ready,
    Versus,
    Ending,
    Credits,
    Blanck,
  ]

  if (window.dev) {
    window.onerror = function (...args) {
      alert("Error: " + args.join(" ")) // eslint-disable-line
      console.log(...args)
    }
  }

  const app = new App()
  const board = new Board()
  const boardDemo = new Board()
  const player = new gameplay.Player()

  app.log("cordova ?", window.cordova)

  const game = new Phaser.Game({
    type: window.Phaser.AUTO,
    width: 111,
    height: 60,
    resolution: window.devicePixelRatio,
    // autoResize: true,
    fps: {
      target: 24,
      // forceSetTimeOut: false,
    },
    // audio: { disableWebAudio: true },
    disableCache: true,
    antialias: false,
    pixelArt: true,
    pauseOnBlur: false,
    disableContextMenu: true,
    gameTitle: "Tamagoshifumi",
    gameURL: "www.stunfest.com",
    loader: {
      baseURL: "./assets/",
    },
    banner: { hidePhaser: true },
    scene,
  })

  /* utils */

  const $ = Object.assign({}, consts)

  $.characters = characters
  $.gameplay = gameplay

  $.clear = () => {
    game.scene._pending.forEach((item) => {
      item.autoStart = false
    })
    game.scene.scenes.forEach(({ scene }) => {
      scene.scene.time.clearPendingEvents()
      game.scene.stop(scene.key)
    })
  }

  $.clear()

  game.events.on("ready", () => {
    pipelines(game)
    app.log("--- game.ready ---")
    // $.clear();
    game.sound.pauseOnBlur = false
  })

  /* gameplay */
  $.PAIRS = {}
  $.ENDINGS.forEach((item) => {
    const parts = item.split("_")
    parts.forEach((key) => {
      $.PAIRS[key] = $.PAIRS[key] || {}
      parts.forEach((k) => {
        if (k === key && key !== item) return
        $.PAIRS[key][k] = $.PAIRS[key][k] || []
        $.PAIRS[key][k].push(item)
      })
    })
  })

  $.unlock = (name) => {
    $.SPLASH_STAGES.push($.characters[name].stage)
  }

  $.save = () => {
    window.localStorage.setItem("player", JSON.stringify(player))
  }

  $.end = () => {
    let unlocked
    let ending
    Object.entries($.UNLOCK).forEach(([name, val]) => {
      if (!player.unlocked.includes(name)) {
        if (val.includes(player.main) && val.includes(player.lover)) {
          player.unlocked.push(name)
          $.unlock(name)
          unlocked = name
        }
      }
    })

    if ($.PAIRS[player.main]) {
      if ($.PAIRS[player.main][player.lover]) {
        ending = Phaser.Utils.Array.GetRandom(
          $.PAIRS[player.main][player.lover],
        )
      } else if ($.PAIRS[player.main][player.main]) {
        ending = Phaser.Utils.Array.GetRandom($.PAIRS[player.main][player.main])
      }
    }

    player.reset()
    $.save()

    return {
      unlocked,
      ending,
    }
  }

  $.go = (scene, target, arg) => {
    app.log("$.go ---", target)
    board.close()
    if ($.loaded) {
      scene.scene.start(target, arg)
    } else {
      game.events.off("zou")
      game.events.once("zou", () => {
        app.log("--- zou ---", target)
        scene.scene.start(target, arg)
      })
      scene.scene.start("Splash")
    }
  }

  $.newGame = (scene) => {
    if (!player.main) {
      $.go(scene, "Select", "character")
    } else if (!player.lover) {
      $.go(scene, "Select", "partner")
    } else {
      $.start(scene)
    }
  }

  $.initRival = () => {
    if (player.win < 7) {
      window.rival = new gameplay.Rival(game, player.prog[player.win])
    } else {
      window.rival = new gameplay.Boss(game)
    }
  }

  $.startSolo = () => {
    player.win = 0
    player.fresh()
    player.btsScores.length = 0
    const rivals = {
      one: $.ONE.filter((item) => item !== player.main),
      two: $.TWO.filter((item) => item !== player.main),
    }
    player.prog = [
      // "kent",
      ...shuffle(rivals.one),
      ...shuffle(rivals.two),
      "boss",
    ]
    $.save()
  }

  $.win = (scene) => {
    player.win++
    player.fresh()
    $.save()
    if (player.win > 7) {
      $.go(scene, "Ending")
    } else {
      $.go(scene, "Solo", "win")
    }
  }

  $.lose = (scene) => {
    $.go(scene, "Solo", "lose")
  }

  $.restartProg = (scene) => {
    $.startSolo()
    $.go(scene, "Menu")
  }

  $.start = (scene) => {
    // $.startSolo();
    if (!player.prog) $.startSolo()
    $.go(scene, "Solo", "win")
  }

  $.bts = (score) => {
    player.btsScores.push(score)
    if (player.btsScores.length > 6)
      player.btsScores = player.btsScores.slice(-5)
    const median = stats.median(player.btsScores)
    const stdev = stats.stdev(player.btsScores)
    const min = Math.max(2, median - Math.random() * stdev)
    const max = Math.max(8, median + Math.random() * (stdev / 1.5))
    let r = Math.round(rng(min, max))
    if (r === score) r = Math.max(1, score - rng(1, 6))
    if ($.dev) {
      console.log("//////////// BTS ////////////")
      console.log(`player scores: [${player.btsScores.join(",")}]`)
      console.log(
        `median: ${median}, stdev: ${stdev}, min: ${min}, max: ${max}`,
      )
      console.log(`rival score: ${r}`)
      console.log(`player score: ${score}`)
    }
    return Math.round(r)
  }

  /* dev */
  const clean = () => {
    board.close()
    $.clear()
    if (!player.main) player.main = gameplay.randomChar()
    if (!player.lover) player.lover = gameplay.randomChar()
    $.startSolo()
  }

  if (window.dev) {
    // document.body.classList.add("app_dev");
    $.dev = {
      FIGHT: (skipIntro) => {
        clean()
        player.random()
        if (skipIntro) {
          player.win = Math.round(Math.random() * 5)
          $.initRival()
          // rival.poo = 3;
          $.go(game, "Versus")
        } else {
          $.go(game, "Ready")
        }
      },
      BOSS: () => {
        clean()
        player.win = 7
        $.go(game, "Ready")
      },
      ENDING: () => {
        clean()
        player.win = 7
        $.go(game, "Ending")
        // $.go(game, "Credits");
      },
      NEW_GAME_PLUS: () => {
        clean()
        player.unlocked.push(...$.TWO)
        player.setup()
        $.go(game, "Menu")
      },
      HOME: () => {
        clean()
        $.go(game, "Home")
      },
    }
  }

  /*  */

  $.menu = () => {
    player.fresh()
    $.clear()
    /*  */
    // player.main = "";
    // $.dev.ENDING();
    /*  */
    if ($.quit) {
      $.quit = false
      $.go(game, "Solo", "lose")
    } else $.go(game, "Menu")
  }

  window.$ = $
  window.board = board
  window.boardDemo = boardDemo
  window.app = app
  window.game = game
  window.player = player
  window.gameplay = gameplay
  window.clean = clean

  player.assign(JSON.parse(window.localStorage.getItem("player")))

  // document.addEventListener(
  //   "pause",
  //   () => {
  //     game.sound.mute = true
  //   },
  //   false
  // )
  // document.addEventListener(
  //   "resume",
  //   () => {
  //     game.sound.mute = false
  //   },
  //   false
  // )
  // document.addEventListener(
  //   "visibilitychange",
  //   () => {
  //     if (document.hidden) {
  //       game.sound.mute = true
  //     } else {
  //       game.sound.mute = false
  //     }
  //   },
  //   false
  // )

  document.body.appendChild(app.el)

  app.go("stick")
}
