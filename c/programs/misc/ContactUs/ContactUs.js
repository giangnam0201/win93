import { alert } from "../../../../42/ui/layout/dialog.js"

const icon = new URL("./icon-32.png", import.meta.url).href

let dialogEl

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  await alert(
    [
      {
        tag: "a",
        href: "mailto:contact@windows93.net",
        content: "contact@windows93.net",
      },
      { tag: "br" },
      {
        tag: "a",
        target: "_blank",
        href: "https://discord.gg/bYFhRTMmMK",
        content: "official discord server",
      },
    ],
    {
      dialog: {
        sound: false,
        dockable: false,
        animation: false,
        created: (el) => {
          dialogEl = el
        },
        on: {
          "ui:dialog.close": () => {
            app.destroy()
          },
        },
      },
      label: "CONTACT US",
      img: icon,
    },
  )
}

export function destroyApp() {
  dialogEl?.close()
}
