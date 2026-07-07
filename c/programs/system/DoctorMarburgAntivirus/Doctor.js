import { alert, confirm, prompt } from "../../../../42/ui/layout/dialog.js"
import { os } from "../../../../42/api/os.js"

function scan() {
  const viruses = []

  for (const item of os.apps.launched.values()) {
    const { categories } = item.manifest
    if (!categories) continue
    if (categories.includes("Malware") || categories.includes("Virus")) {
      viruses.push(item)
    }
  }

  return viruses
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
async function doctor(app) {
  const options = {
    label: "Doctor Marburg Antivirus",
    icon: app.getIcon(),
    dialog: { class: { doctor: true } },
  }

  async function killAllVirus(success, fail) {
    const viruses = scan()
    for (const virus of viruses) virus.destroy()

    await (viruses.length > 0
      ? alert(success ?? "All Virus Killed !", options)
      : alert(fail ?? "No Virus detected.", options))
  }

  const diagnostics = [
    async () => {
      await alert("Breathe in and out please...", {
        ...options,
        agree: "Breathe",
      })

      return killAllVirus(
        "Inhale inhale. You're the victim",
        "Diagnostic : Psycho-somatic addict-insane",
      )
    },
    async () => {
      const res = await prompt("Say 99...", {
        ...options,
        agree: "Say it",
      })

      if (res && res.trim() === "99") {
        return killAllVirus(
          "That's what I thought, you were full of viruses, I've just rid you of them!",
        )
      }

      if (res !== undefined) {
        const ok = await confirm(
          "Mhh, you're very sick, unfortunately I can't do anything for you... Except cleaning your computer",
          { ...options, agree: "Let's do that" },
        )
        if (ok) return killAllVirus()
      }
    },
    async () => {
      let ok
      ok = await confirm(
        "Welcome to Doctor Marburg Antivirus.\nWould you like to clean your System ?",
        {
          ...options,
          agree: "Yep!",
        },
      )
      if (!ok) return killAllVirus("Task failed successfully.")

      ok = await confirm(
        [
          { tag: "strong", content: "Warning !" },
          "\nDoctor Marburg is not responsible for direct, indirect, incidental or consequential damages resulting from any defect, error or failure to perform this ilegal operation.\n\nDo you want to perform anyway ?",
        ],
        {
          ...options,
          agree: "Sure",
          decline: "Not really",
        },
      )

      if (!ok) return alert("You're such a coward", options)

      return killAllVirus()
    },
    async () => {
      let ok
      ok = await confirm(
        "Welcome to Doctor Marburg Antivirus.\nWould you like to clean your System ?",
        {
          ...options,
          agree: "Yep!",
        },
      )
      if (!ok) return killAllVirus("Well, I did it anyway ^^")

      ok = await prompt("Ok, please confirm with your credit card number", {
        ...options,
        agree: "Sure",
        decline: "Never Mind",
      })

      if (!ok) {
        return killAllVirus(
          "I was just testing you ;)\nI cleaned the system",
          "I was just testing you ;)\nThere is no virus on the system anyway",
        )
      }

      return alert(
        [
          { tag: "strong", content: "Illegal operation detected !" },
          "\nDOCTOR MARBURG had blocked the following malware application to perform an ilegal operation:\n\n",
          { tag: "em", content: "DOCTOR MARBURG - Illegal operation detected" },
        ],
        options,
      )
    },
  ]

  if (Math.random() > 0.75) {
    const viruses = scan()
    if (viruses.length > 0) {
      const ok = await confirm(`That ${viruses.at(-1).name} virus again ?`, {
        ...options,
        agree: "Yep!",
        decline: "Nope!",
      })

      if (ok) {
        killAllVirus("Don't click on it next time").then(() => app.destroy())
      } else app.destroy()
      return
    }
  }

  const diagnostic = diagnostics[Math.floor(Math.random() * diagnostics.length)]
  diagnostic().then(() => app.destroy())
}

/**
 * @param {import("42/api/os/App.js").App} app
 */
export async function launchApp(app) {
  doctor(app)
}

export function destroyApp() {
  for (const item of document.querySelectorAll("ui-dialog.doctor")) {
    // @ts-ignore
    item.destroy()
  }
}
