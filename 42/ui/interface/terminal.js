import { Component } from "../../api/gui/Component.js"
import { clipboard } from "../../api/io/clipboard.js"
import { loadCSS } from "../../api/load/loadCSS.js"
import { loadScript } from "../../api/load/loadScript.js"
import { ansi } from "../../api/log/ansi.js"
import { watchResize } from "../../lib/type/element/watchResize.js"
import { fit } from "./terminal/fit.js"
import { Shell } from "./terminal/Shell.js"

const libs = Promise.all([
  loadScript("/c/libs/xterm/5.5/xterm.js"),
  loadScript("/c/libs/xterm/5.5/addon-unicode11.js"),
  // loadScript("/c/libs/xterm/5.5/addon-webgl.js"),
  loadCSS("/c/libs/xterm/5.5/xterm.css"),
])

async function createTerminal(options) {
  await Promise.all([
    libs,
    document.fonts.load(`${options.fontSize}px ${options.fontFamily}`),
  ])

  // @ts-ignore
  const terminal = new window.Terminal(options)

  // const { WebglAddon } = window.WebglAddon
  // terminal.loadAddon(new WebglAddon())

  // @ts-ignore
  const { Unicode11Addon } = window.Unicode11Addon
  terminal._core.optionsService.rawOptions.allowProposedApi = true
  terminal.loadAddon(new Unicode11Addon())
  terminal.unicode.activeVersion = "11"

  return terminal
}

export class TerminalComponent extends Component {
  static plan = {
    tag: "ui-terminal",
    on: {
      "Ctrl+Shift+C": (e, target) => {
        clipboard.copy(target.term.getSelection())
        return false
      },
    },
  }

  async created() {
    const { signal } = this
    const styles = getComputedStyle(this)

    const options = {
      fontSize: Number.parseInt(styles.fontSize, 10),
      fontFamily: styles.fontFamily,
      // rescaleOverlappingGlyphs: true,
      theme: {
        background: "#000000",
        foreground: "#c3ff00",
        cursor: "#c3ff00",
      },
    }

    this.term = await createTerminal(options)
    this.term.open(this)

    this.shell = new Shell(this.term, {
      exec: this.getAttribute("exec"),
      greet: this.getAttribute("greet"),
      prompt(shell) {
        return ansi(
          `\r\n{blueBright ${
            shell.env.PWD.startsWith(shell.env.HOME)
              ? shell.env.PWD.replace(shell.env.HOME, "~")
              : shell.env.PWD
          }}\r\n{${shell.status === 0 ? "reset" : "redBright"} >} `,
        )
      },
    })

    watchResize(this, { signal }, () => this.fit())
    this.fit()
  }

  fit() {
    fit(this.term)
    this.scrollTop = 0
  }

  write(data) {
    this.term.write(ansi(data.replaceAll("\n", "\n\r")))
  }

  clear() {
    this.term.clear()
  }
}

export const terminal = Component.define(TerminalComponent)
