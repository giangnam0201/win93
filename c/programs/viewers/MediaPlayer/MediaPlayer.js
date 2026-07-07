import "../../../../42/ui/layout/menu.js"
import "../../../../42/ui/media/player.js"
import "../../../../42/ui/media/scope.js"
import "../../../../42/ui/media/picto.js"
import { os } from "../../../../42/api/os.js"
import { getBasename } from "../../../../42/lib/syntax/path/getBasename.js"
import { audioMetadata } from "../../../../42/formats/metadata/audioMetadata.js"
import { TRANSPARENT } from "../../../../42/lib/constant/TRANSPARENT.js"
import { noop } from "../../../../42/lib/type/function/noop.js"

/** @import { PlayerComponent } from "../../../../42/ui/media/player.js" */

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function renderApp(app) {
  const state = await app.initState({
    chain: "play-all",
  })

  /** @type {PlayerComponent} */
  let playerEl

  let trackTitleEl
  let trackCoverEl
  let audioMetadataEl
  let chainEl

  /** @type {HTMLButtonElement} */
  let prevBtn
  /** @type {HTMLButtonElement} */
  let nextBtn

  async function setMetadata(fileAgent) {
    if (playerEl.codec === playerEl.mediaEl) {
      const blob = await fileAgent.getBlob()
      const metadata = await audioMetadata(blob).catch(noop)
      if (metadata?.title) {
        const artist = metadata.albumartist ?? metadata.artist
        trackTitleEl.textContent = artist
          ? `${artist} - ${metadata.title}`
          : metadata.title
      }
      if (metadata?.picture) {
        trackCoverEl.src = URL.createObjectURL(await metadata.getCoverBlob())
        trackCoverEl.parentElement.classList.toggle("hide", false)
        return
      }
    } else {
      const { metadata } = playerEl.codec
      // console.log(metadata)
      if (metadata?.title) {
        const artist = metadata.author ?? metadata.artist
        trackTitleEl.textContent = artist
          ? `${artist} - ${metadata.title}`
          : metadata.title
      }
    }

    trackCoverEl.parentElement.classList.toggle("hide", true)
  }

  function changeChain(e, target) {
    chainEl.firstChild.value = target.value
    state.chain = target.value
    applyChain()
  }

  function applyChain() {
    playerEl.loop = state.chain === "loop"

    if (app.file) {
      app.file.adjacents.loop = state.chain === "loop-all"
      app.file.adjacents.random = state.chain === "shuffle"
      app.file.adjacents.registerButtons(prevBtn, nextBtn)
    }
  }

  app
    .once("ready", () => {
      if ("moveBefore" in Element.prototype) {
        app.dialogEl.addEventListener(
          "ui:dialog.before-remove",
          () => {
            if (!playerEl.mediaEl.isConnected) return
            // @ts-ignore
            document.documentElement.moveBefore(playerEl.mediaEl, document.body)
            playerEl.mediaEl.classList.toggle("hide", true)
          },
          { once: true },
        )
      }
    })
    .on("decode", async (fileAgent) => {
      applyChain()
      fileAgent.adjacents.registerButtons(prevBtn, nextBtn)
      playerEl.removeAttribute("aria-busy")

      trackTitleEl.textContent = getBasename(app.file.path)
      if (trackCoverEl.src.startsWith("blob:")) trackCoverEl.src = TRANSPARENT
      const res = await playerEl.load(fileAgent.path)
      if (res !== false) setMetadata(fileAgent)
    })

  let video = false

  if (app.file) {
    const { mimetype } = os.mimetypes.lookup(app.file.path)
    if (mimetype?.startsWith("video/")) video = true
  }

  return {
    tag: "ui-player.app__media__player",
    audioContext: os.mixer.context,
    autoplay: app.config.play !== false,
    loop: app.config.loop,
    volume: app.config.volume,
    mixer: false,
    aria: { busy: true },
    video,
    created(el) {
      playerEl = el

      playerEl.amp.disconnect()
      os.mixer.addTrack(playerEl.amp, { app, fadeIn: 0 })

      if (!app.file) {
        playerEl.removeAttribute("aria-busy")
        app.resize({ animate: false })
      }
    },
    on: {
      "ui:player.loaded || ui:player.unload": () => {
        audioMetadataEl.style.maxInlineSize = "0px"
        app.resize({ animate: false })
        audioMetadataEl.style.removeProperty("max-inline-size")
      },
      "ui:player.ended": () => {
        if (state.chain !== "play-one") {
          app.file.adjacents.next()
        }
      },
    },
    controls: [
      {
        tag: ".rows.grow.h-full.gap-xxs",
        content: [
          {
            tag: ".app__media__audio-metadata.cols.gap-xxxs",
            created(el) {
              audioMetadataEl = el
            },
            content: [
              {
                tag: ".app__media__audio-cover.hide.inset.screen.shrink._overlap.ratio",
                content: [
                  {
                    tag: "img.fit-contain",
                    src: TRANSPARENT,
                    created(el) {
                      trackCoverEl = el
                    },
                  },
                ],
              },
              {
                tag: ".app__media__audio-title.screen.inset.pa-sm.txt-zwsp.truncate",
                content: "",
                created(el) {
                  trackTitleEl = el
                },
              },
              {
                tag: "ui-scope.app__media__audio-scope",
                created(el) {
                  el.audioInput = playerEl.amp
                },
              },
            ],
          },
          {
            tag: ".cols.shrink",
            content: ["seek"],
          },
          {
            tag: ".app__media__controls.flex.shrink.items-center.gap-xs",
            content: [
              "play",
              "stop",
              {
                tag: ".cols",
                content: [
                  {
                    tag: "button.ui-player__prev._clear",
                    picto: "backward",
                    disabled: true,
                    action: () => app.file.adjacents.prev(),
                    created(el) {
                      prevBtn = el
                    },
                  },
                  {
                    tag: "button.ui-player__next._clear",
                    picto: "forward",
                    disabled: true,
                    action: () => app.file.adjacents.next(),
                    created(el) {
                      nextBtn = el
                    },
                  },
                ],
              },
              {
                tag: "button.ui-player__eject._clear",
                picto: "eject",
                on: { click: () => app.openFile() },
              },

              "elapsed",
              "/",
              "duration",
              { tag: ".ma-r-auto" },
              // "seek",
              // "loop",
              {
                tag: "button.ui-player__chain._clear",
                picto: state.chain,
                created(el) {
                  chainEl = el
                },
                menu: [
                  {
                    tag: "radio",
                    checked: () => state.chain === "play-all",
                    name: app.id + "__chain",
                    picto: "play-all",
                    value: "play-all",
                    label: "Play all tracks",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "play-one",
                    name: app.id + "__chain",
                    picto: "play-one",
                    value: "play-one",
                    label: "Play single track",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "loop-all",
                    name: app.id + "__chain",
                    picto: "loop-all",
                    value: "loop-all",
                    label: "Loop all tracks",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "loop",
                    name: app.id + "__chain",
                    picto: "loop",
                    value: "loop",
                    label: "Loop single track",
                    action: changeChain,
                  },
                  {
                    tag: "radio",
                    checked: () => state.chain === "shuffle",
                    name: app.id + "__chain",
                    picto: "shuffle",
                    value: "shuffle",
                    label: "Shuffle",
                    action: changeChain,
                  },
                ],
              },
              {
                tag: "button.ui-player__settings._clear",
                picto: "cog",
                on: {
                  click: () => os.toast("Comming soon"),
                },
              },
              "mute",
              "volume",
            ],
          },
        ],
      },
    ],
  }
}
