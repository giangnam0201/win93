/* eslint-disable complexity */
import "/c/programs/misc/FX/fx.js"
import {
  alert,
  DialogComponent,
  prompt,
} from "../../../../42/ui/layout/dialog.js"
import { toast } from "../../../../42/ui/layout/toast.js"
import { explorer } from "../../../../42/ui/desktop/explorer.js"
import { MIDIFile } from "../../../../42/formats/midi/MIDIFile.js"
import { mixer } from "../../../../42/lib/audio/mixer.js"
import { configure } from "../../../../42/api/configure.js"
import { unloadIframe } from "../../../../42/lib/dom/reloadIframe.js"
import { randomItem } from "../../../../42/lib/type/array/randomItem.js"

const folders = [
  "/c/",
  "/c/libs/",
  "/c/users/windows93/",
  "/c/users/windows93/desktop",
  "/c/users/windows93/interface/wallpapers/ms/win3.1x/",
  "/c/users/windows93/roms/dmg/music/",
]

function pointFromPointAngleRadius(myPoint, myAngle, myRadius) {
  const newPoint = [0, 0]
  newPoint[0] =
    myPoint[0] + Math.cos((myAngle * 3.14) / 180) * Math.floor(myRadius)
  newPoint[1] =
    myPoint[1] + Math.sin((myAngle * 3.14) / 180) * Math.floor(myRadius)
  return newPoint
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  const { signal } = app

  const audioContext = mixer.context
  const { mainTrack } = mixer
  let trackStartTime = 0

  const desktopEl = document.querySelector("#desktop")

  const track = new Audio(
    import.meta.resolve(`./assets/CRAZY-ERROR-170BPM.mp3`),
  )

  track.volume = 0.5

  const splashEl = document.createElement("iframe")
  splashEl.src = import.meta.resolve(
    "/c/users/windows93/interface/splashs/v3.voxel.html",
  )
  splashEl.className = "hide"
  splashEl.style.cssText = /* style */ `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: calc(var(--z-dialog) - 1);`
  desktopEl.prepend(splashEl)

  const bsodEl = new Image()
  bsodEl.src = import.meta.resolve("./assets/BSoD.png")
  bsodEl.className = "hide pixelated"
  bsodEl.style.cssText = /* style */ `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: calc(var(--z-dialog) - 1);`
  desktopEl.prepend(bsodEl)

  const assets = [
    fetch(import.meta.resolve("./assets/CRAZY-ERROR-170BPM.mid")).then((res) =>
      res.arrayBuffer(),
    ),
    new Promise((resolve) => {
      track.oncanplaythrough = () => resolve(track)
    }),
    new Promise((resolve) => {
      splashEl.onload = () => resolve()
    }),
    bsodEl.decode(),
  ]

  const sounds = {}
  const soundBuffers = {}

  for (let i = 24; i < 42; i++) {
    const url = import.meta.resolve(`./assets/sounds/${i}.mp3`)

    assets.push(
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => audioContext.decodeAudioData(b))
        .then((buffer) => {
          soundBuffers[i] = buffer
        }),
    )

    sounds[i] = (when = 0) => {
      const buffer = soundBuffers[i]
      if (!buffer) return
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(mainTrack)
      source.start(when)
    }
  }

  const baseDialog = {
    // signal: app.signal,
    dialog: {
      sound: false,
      stealFocus: false,
      skipAutoPosition: true,
      dockable: false,
      dataset: { animationIn: false },
    },
  }

  const notes = {
    24(seq, when = 0) {
      sounds[24](when)
      alert(
        configure(
          baseDialog,
          {
            label: "Error",
            message:
              "Setup detected that teh operating system in use is not Windows " +
              "2000 or XP. This setup program and its associated drivers are " +
              "designed to run only on Windows 2000 or XP. The installation will " +
              "be terminated.",
            icon: "error",
            dialog: { dataset: { animationOut: "random" } },
          },
          seq,
        ),
      )
    },
    25(seq, when = 0) {
      sounds[25](when)
      alert(
        configure(
          baseDialog,
          {
            label: "TADAAAA",
            message: "タスクが正常に失敗しました",
            icon: "/c/users/windows93/interface/icons/32x32/misc/trophy.png",
            agree: "ワオ",
            dialog: { dataset: { animationIn: "tada" } },
          },
          seq,
        ),
      )
    },
    26(seq, when = 0) {
      sounds[26](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message: "タスクが正常に失敗しました",
            icon: "warning",
            agree: "ワオ",
            dialog: {
              randomPosition: true,
            },
          },
          seq,
        ),
      )
    },
    27(seq, when = 0) {
      sounds[27](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message: "タスクが正常に失敗しました",
            icon: "info",
            agree: "ワオ",
            dialog: {
              randomPosition: true,
              style: { scale: "2" },
              created: (el) => setTimeout(() => el.close(), 100),
            },
          },
          seq,
        ),
      )
    },
    28(seq, when = 0) {
      sounds[28](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message: "タスクが正常に失敗しました",
            icon: "error",
            agree: "ワオ",
            dialog: {
              randomPosition: true,
            },
          },
          seq,
        ),
      )
    },
    29(seq, when = 0) {
      sounds[29](when)
      alert(
        configure(
          baseDialog,
          {
            label: "POUM",
            message: "タスクが正常に失敗しました",
            icon: "/c/users/windows93/interface/icons/32x32/no.png",
            agree: "ワオ",
            // dialog: {
            //   randomPosition: true,
            // },
          },
          seq,
        ),
      )
    },
    30(seq, when = 0) {
      sounds[30](when)
      alert(
        configure(
          baseDialog,
          {
            label: "TCHAK",
            message: '何か問題でも "C:\\Program Files" 笑',
            icon: "/42/assets/icons/32x32/apps/settings.png",
            agree: "いいえ",
            decline: "うん",
            // dialog: {
            //   randomPosition: true,
            // },
          },
          seq,
        ),
      )
    },
    31(seq, when = 0) {
      sounds[31](when)
      alert(
        configure(
          baseDialog,
          {
            label: "ウィンドウ",
            message:
              "曖昧さ回避 この項目では、コンピュータのウィンドウシステムにおけるウィンドウについて説明しています。一般的な「窓」については「窓」をご覧ください。フロー制御におけるウィンドウについては「スライディングウィンドウ」をご覧ください。シャープの液晶テレビのブランド名称については「ウィンドウ (シャープの製品)」をご覧ください。芸能事務所については「ウィンドー (芸能プロダクション)」をご覧ください。PEARLのアルバムについては「WINDOW」をご覧ください。",
            icon: "/c/users/windows93/interface/icons/32x32/memes/lol.png",
            agree: "いいえ",
            decline: "うん",
            dialog: {
              created: (el) => setTimeout(() => el.close(), 1320),
            },
          },
          seq,
        ),
      )
    },
    32(seq, when = 0) {
      sounds[32](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message: '何か問題でも "C:\\Program Files" 笑',
            icon: "/c/users/windows93/interface/icons/32x32/memes/yea.png",
            agree: "いいえ",
            decline: "うん",
            dialog: {
              randomPosition: true,
            },
          },
          seq,
        ),
      )
    },
    33(seq, when = 0) {
      sounds[33](when)
      toast({ message: "あまりにも多くのエラー笑", timeout: 1500 })
    },
    34(seq, when = 0) {
      sounds[34](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message: '何か問題でも "C:\\Program Files" 笑',
            icon: "/c/users/windows93/interface/icons/32x32/floppy-format.png",
            agree: "いいえ",
            decline: "うん",
            dialog: {
              // dataset: {
              //   animationIn: "flipInX",
              //   // animationOut: "random",
              // },
              randomPosition: true,
            },
          },
          seq,
        ),
      )
    },
    35(seq, when = 0) {
      sounds[35](when)
      alert(
        configure(
          baseDialog,
          {
            label: "あまりにも多くのエラー笑",
            message: "Windowsエクスプローラが動作を停止しました",
            icon: "warning",
            agree: "いいえ",
            decline: "うん",
            dialog: {
              randomPosition: true,
            },
            width: 200,
          },
          seq,
        ),
      )
    },
    36(seq, when = 0) {
      sounds[36](when)
      alert(
        configure(
          baseDialog,
          {
            label: "あまりにも多くのエラー笑",
            message: "Windowsエクスプローラが動作を停止しました",
            icon: "question",
            agree: "いいえ",
            decline: "うん",
            dialog: {
              dataset: {
                animationIn: "jackInTheBox",
                animationOut: "zoomOut",
              },
            },
            signal: undefined,
          },
          seq,
        ),
      )
    },
    37(seq, when = 0) {
      sounds[37](when)
      alert(
        configure(
          baseDialog,
          {
            label: "エラー",
            message:
              '曖昧さ回避 "C:\\WINDOWS" 私は何を入力しているのか分かりません',
            icon: "error",
            dialog: {
              dataset: {
                animationIn: randomItem([
                  "zoomInRight",
                  "zoomInLeft",
                  "zoomInUp",
                  "zoomInDown",
                ]),
                animationOut: randomItem([
                  "zoomOutLeft",
                  "zoomOutRight",
                  "zoomOutUp",
                  "zoomOutDown",
                ]),
              },
              randomPosition: true,
            },
          },
          seq,
        ),
      )
    },
    38(seq, when = 0) {
      sounds[38](when)
      prompt(
        configure(
          baseDialog,
          {
            message: "Enter your Credit card number",
            dialog: {
              randomPosition: true,
              dataset: {
                animationIn:
                  when < 44
                    ? randomItem([
                        "zoomInRight",
                        "zoomInLeft",
                        "zoomInUp",
                        "zoomInDown",
                      ])
                    : "wobble",
                animationOut:
                  when < 44
                    ? randomItem([
                        "zoomOutLeft",
                        "zoomOutRight",
                        "zoomOutUp",
                        "zoomOutDown",
                      ])
                    : false,
              },
            },
          },
          seq,
        ),
      )
    },
    39(seq, when = 0) {
      sounds[39](when)
      alert(
        configure(
          {
            label: "エラー",
            message:
              '曖昧さ回避 "C:\\WINDOWS" 私は何を入力しているのか分かりません',
            icon: "/c/users/windows93/interface/icons/32x32/memes/derp.png",
            agree: "OK",
            dialog: {
              dataset: {
                animationIn: "random",
                animationOut: "random",
              },
              randomPosition: true,
              created: (el) => setTimeout(() => el.close(), 500),
            },
          },
          baseDialog,
          seq,
        ),
      )
    },
    40(seq, when = 0) {
      sounds[40](when)
      if (when < 40) return
      explorer(
        folders[~~(Math.random() * folders.length)],
        configure(
          baseDialog,
          {
            dialog: {
              width: 300 + Math.random() * 150,
              height: 150 + Math.random() * 150,
              randomPosition: true,
              created: (el) => setTimeout(() => el.close(), 500),
            },
          },
          seq,
        ),
      )
    },
    // 41(seq, when = 0) {
    //   console.log(41_111_111_111_111_111)
    //   sounds[41](when)
    //   alert(
    //     configure(
    //       baseDialog,
    //       {
    //         label: "Error",
    //         message:
    //           "%md Windows has detected that your monitor\nis not plugined in.",
    //         icon: "/42/assets/icons/32x32/apps/shutdown.png",
    //         agree: "wat",
    //         dialog: {
    //           dataset: {
    //             animationIn: "wobble",
    //             animationOut: "random",
    //           },
    //           randomPosition: true,
    //         },
    //       },
    //       seq,
    //     ),
    //   )
    // },
  }

  const [midiBuffer] = await Promise.all(assets)

  const midiFile = new MIDIFile(midiBuffer)

  midiFile.header.setTicksPerBeat(
    (midiFile.header.getTicksPerBeat() / 120) * 170,
  )

  const events = midiFile.getMidiEvents()

  let splashCnt = 0

  const bsod = {
    show: () => bsodEl.classList.remove("hide"),
    hide: () => bsodEl.classList.add("hide"),
  }
  const splash = {
    show: async () => {
      if (splashCnt++) {
        splashEl.src = import.meta.resolve(
          "/c/users/windows93/interface/splashs/v3.html",
        )
        await new Promise((resolve) => {
          splashEl.onload = resolve
        })
      }
      splashEl.classList.remove("hide")
    },
    hide: () => {
      splashEl.classList.add("hide")
      unloadIframe(splashEl)
    },
  }

  const w2 = desktopEl.offsetWidth / 2
  const h2 = desktopEl.offsetHeight / 2

  const trigo = {
    cnt: 0,
    exec(total) {
      const xy = pointFromPointAngleRadius(
        [w2, h2],
        this.cnt * (360 / total) - 90,
        desktopEl.offsetWidth / 5,
      )
      this.cnt++
      return {
        x: xy[0] - 380 / 2,
        y: xy[1] - 110 / 2,
      }
    },
  }

  const spin = {
    cnt: 0,
    exec(total) {
      const xy = pointFromPointAngleRadius(
        [w2, h2],
        this.cnt * (360 / total) - 90,
        desktopEl.offsetWidth / 5,
      )
      this.cnt++
      return {
        x: xy[0] - 380 / 2,
        y: xy[1] - 110 / 2,
        dialog: {
          class: {
            "fx-spin": true,
          },
        },
      }
    },
  }

  const OK = {
    cnt: 0,
    exec() {
      const xy = pointFromPointAngleRadius(
        [w2, h2],
        this.cnt * (360 / 10) - 90,
        desktopEl.offsetWidth / 5,
      )
      this.cnt++
      return {
        x: xy[0] - 380 / 2,
        y: xy[1] - 110 / 2,
        dialog: {
          style: {
            scale: this.cnt / 2,
          },
        },
      }
    },
  }

  let sequences

  function resetSeq() {
    trigo.cnt = 0
    spin.cnt = 0
    OK.cnt = 0
    sequences = [
      { y: 200, x: 200 },
      { y: 23, x: 23 },
      { y: 23, x: desktopEl.offsetWidth - 300 - 23 },
    ]
  }

  resetSeq()

  const curTime = 0

  // notes[29](sequences[1])
  // notes[30](sequences[2])
  // notes[33]()
  // return

  const seqNum = {}
  const seqStart = {}
  const seqCursor = {}
  let lastParam

  const timers = []

  function getTotal(param) {
    const total = seqNum[param][seqCursor[param]]
    return total
  }

  for (let i = 0, j = events.length; i < j; i++) {
    if (signal.aborted) break

    const ev = events[i]

    if (ev.param2 > 70 && ev.param1 !== 0) {
      if (lastParam !== ev.param1) {
        seqCursor[ev.param1] = -1
        seqStart[i] = ev.param1
        if (seqNum[ev.param1]) {
          seqNum[ev.param1].push(0)
        } else {
          seqNum[ev.param1] = [0]
        }
      }

      lastParam = ev.param1
      seqNum[ev.param1][seqNum[ev.param1].length - 1]++
    }

    if (i === 0) {
      timers.push(
        setTimeout(() => {
          trackStartTime = audioContext.currentTime
          track.play()
        }, curTime + ev.playTime),
      )
    }

    const timerId = setTimeout(() => {
      const when = trackStartTime + ev.playTime / 1000

      if (seqStart[i]) seqCursor[seqStart[i]]++

      if (ev.param1 === 0 && ev.param2 >= 70) {
        resetSeq()

        for (const dialogEl of [...DialogComponent.tracker]) {
          if (dialogEl.app?.command === "terminal") continue
          dialogEl.close()
        }
      }

      if (ev.param1 === 24) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          sequences[0].x += 23
          sequences[0].y += 23
          notes[ev.param1](sequences[0], when)
        }
      } else if (ev.param1 === 39) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          notes[ev.param1](OK.exec(), when)
        }
      } else if (ev.param1 === 35) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          const tt = getTotal(ev.param1)
          if (tt > 5) {
            notes[ev.param1](spin.exec(getTotal(ev.param1)), when)
          } else {
            notes[ev.param1](undefined, when)
          }
        }
      } else if (ev.param1 === 26) {
        if (ev.param2 < 70) bsod.hide()
        else bsod.show()
      } else if (ev.param1 === 41) {
        if (ev.param2 < 70) splash.hide()
        else splash.show()
      } else if (ev.param1 === 42) {
        if (ev.param2 < 70) splash.hide()
        else splash.show()
      } else if (ev.param1 === 29) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          sequences[1].x += 23
          sequences[1].y += 23
          notes[ev.param1](sequences[1], when)
        }
      } else if (ev.param1 === 30) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          sequences[2].x -= 23
          sequences[2].y += 23
          notes[ev.param1](sequences[2], when)
        }
      } else if (ev.param1 === 32) {
        if (ev.param2 >= 70 && notes[ev.param1]) {
          notes[ev.param1](trigo.exec(getTotal(ev.param1)), when)
        }
      } else if (ev.param2 > 100 && notes[ev.param1]) {
        notes[ev.param1](undefined, when)
      }
    }, curTime + ev.playTime)

    timers.push(timerId)
  }

  function clean() {
    for (const dialogEl of [...DialogComponent.tracker]) {
      if (dialogEl.app?.command === "terminal") continue
      dialogEl.close()
    }
    for (const timerId of timers) {
      clearTimeout(timerId)
    }
    splashEl?.remove()
    bsodEl?.remove()
  }

  track.addEventListener("ended", () => app.destroy(), { signal })

  signal.addEventListener("abort", () => {
    track.pause()
    clean()
  })
}
