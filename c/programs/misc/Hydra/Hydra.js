import { playSound } from "../../../../42/api/os/systemSounds.js"
import { sleep } from "../../../../42/lib/timing/sleep.js"
import { alert } from "../../../../42/ui/layout/dialog.js"

const icon = new URL("./icon-32.png", import.meta.url).href

let running = true

async function hydra() {
  await alert(
    [
      "Cut off a head, two more will take its place.",
      document.createElement("br"),
      "[ Hydra ViRuS BioCoded by Typhon/Échidna ]",
    ],
    {
      dialog: {
        sound: false,
        dockable: false,
        animation: false,
        skipAutoPosition: true,
        randomPosition: true,
        class: { hydra: true },
        created: async () => {
          playSound("/c/users/windows93/interface/sounds/Windows 95/CHORD.WAV")
        },
      },
      label: "HYDRA",
      img: icon,
    },
  )

  if (!running) return
  await sleep(Math.random() * 150)
  if (!running) return
  hydra()
  await sleep(Math.random() * 150)
  if (!running) return
  hydra()
}

export async function launchApp() {
  hydra()
}

export function destroyApp() {
  running = false
  for (const item of document.querySelectorAll("ui-dialog.hydra")) {
    // @ts-ignore
    item.destroy()
  }
}
