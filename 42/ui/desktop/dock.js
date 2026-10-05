import { Component } from "../../api/gui/Component.js"
import { render } from "../../api/gui/render.js"
import { Canceller } from "../../lib/class/Canceller.js"
import { getTopElement } from "../../lib/dom/zIndex.js"
import { dispatch } from "../../lib/event/dispatch.js"
import { on } from "../../lib/event/on.js"
import { animateTo } from "../../lib/type/element/animate.js"
import { menu } from "../layout/menu.js"
import { os } from "../../api/os.js"
import { sleep } from "../../lib/timing/sleep.js"
import { Dragger } from "../../lib/dom/Dragger.js"

/** @import { DialogComponent } from "../layout/dialog.js" */

const programs = new Map()

const ghostEl = document.createElement("div")
ghostEl.className = "ui-dock__ghost"
ghostEl.style.cssText = /* style */ `
  opacity: 0;
  pointer-events: none;
  position: absolute;
  top: -500vh;
`
document.documentElement.append(ghostEl)

function showGhost() {
  ghostEl.style.opacity = "1"
  ghostEl.style.top = "0"
}
function hideGhost() {
  ghostEl.style.opacity = "0"
  ghostEl.style.top = "-500vh"
}

/**
 * @param {DialogComponent} dialogEl
 */
function getTitle(dialogEl) {
  if (dialogEl.app && dialogEl.app.name !== dialogEl.title) {
    const index = dialogEl.title.indexOf(" - " + dialogEl.app.name)
    return dialogEl.title.slice(0, index)
  }

  return dialogEl.title
}

function trimSeparators(items) {
  const out = []

  for (const item of items) {
    if (!item) continue
    if (item === "---" && (out.length === 0 || out.at(-1) === "---")) continue
    out.push(item)
  }

  if (out.at(-1) === "---") out.pop()
  return out
}

async function composeMenu(items, definitions, dialogEl) {
  const resolved = await Promise.all(
    items.map(async (item) => {
      if (typeof item === "string" && item !== "---") {
        item = definitions[item]
      }
      if (typeof item === "function") item = await item(dialogEl)
      if (Array.isArray(item?.content)) {
        item = {
          ...item,
          content: await composeMenu(item.content, definitions, dialogEl),
        }
      }
      return item
    }),
  )

  return trimSeparators(resolved)
}

export class DockComponent extends Component {
  static plan = {
    tag: "ui-dock",
    active: true,
  }

  activate(id) {
    const buttonEl = programs.get(id)?.buttonEl
    if (!buttonEl) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const item of this.children) item.ariaPressed = "false"
        buttonEl.ariaPressed = "true"
      })
    })
  }

  minimize(id, cb) {
    const ctx = programs.get(id)
    if (!ctx) return

    const { buttonEl, dialogEl } = ctx
    if (dialogEl.minimized || !dialogEl.minimizable) return cb?.(false)

    ctx.cancel?.()
    const { cancel, signal } = new Canceller()
    ctx.cancel = cancel
    ctx.signal = signal

    buttonEl.classList.toggle("ui-dock__button--minimized", true)
    dialogEl.minimized = true
    // if (dialogEl.app) dialogEl.app.state.dialog.minimized = true

    dialogEl.classList.toggle("hide", false)

    // TODO; use measure() instead of getBoundingClientRect
    const buttonRect = buttonEl.getBoundingClientRect()
    const dialogRect = dialogEl.getBoundingClientRect()
    ctx.dialogRect = dialogRect

    dialogEl.classList.toggle("hide", true)
    showGhost()
    ghostEl.style.width = `${dialogRect.width}px`
    ghostEl.style.height = `${dialogRect.height}px`
    ghostEl.style.translate = `${dialogRect.x}px ${dialogRect.y}px`
    ghostEl.style.rotate = dialogEl.style.rotate

    const topDialogEl = /** @type {DialogComponent} */ (
      getTopElement('ui-dialog:not([role="alertdialog"])', {
        checkIfVisible: true,
      })
    )
    topDialogEl?.activate()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (signal.aborted) return cb?.(false)

        animateTo(ghostEl, {
          signal,
          ms: 180,
          easing: "ease-in",
          commitStylesOnCancel: true,
          width: `${buttonRect.width}px`,
          height: `${buttonRect.height}px`,
          translate: `${buttonRect.x}px ${buttonRect.y}px`,
        }).then(() => {
          if (signal.aborted) return cb?.(false)
          dispatch(dialogEl, "ui:dialog.minimize")
          hideGhost()
          cb?.(true)
        })
      })
    })
  }

  unminimize(id, cb) {
    const ctx = programs.get(id)
    if (!ctx) return

    const { buttonEl, dialogEl, dialogRect } = ctx
    if (!dialogEl.minimized) return cb?.(false)

    ctx.cancel?.()
    const { cancel, signal } = new Canceller()
    ctx.cancel = cancel
    ctx.signal = signal

    buttonEl.classList.toggle("ui-dock__button--minimized", false)
    dialogEl.minimized = false
    // if (dialogEl.app) dialogEl.app.state.dialog.minimized = false
    dialogEl.activate()

    if (ghostEl.style.opacity === "0") {
      showGhost()
      // TODO; use measure() instead of getBoundingClientRect
      const buttonRect = buttonEl.getBoundingClientRect()
      ghostEl.style.width = `${buttonRect.width}px`
      ghostEl.style.height = `${buttonRect.height}px`
      ghostEl.style.translate = `${buttonRect.x}px ${buttonRect.y}px`
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (signal.aborted) return cb?.(false)

        animateTo(ghostEl, {
          signal,
          ms: 180,
          easing: "ease-out",
          commitStylesOnCancel: true,
          width: `${dialogRect.width}px`,
          height: `${dialogRect.height}px`,
          translate: `${dialogRect.x}px ${dialogRect.y}px`,
        }).then(() => {
          if (signal.aborted) return cb?.(false)
          dialogEl.classList.toggle("hide", false)
          dispatch(dialogEl, "ui:dialog.unminimize")
          hideGhost()
          cb?.(true)
        })
      })
    })
  }

  created() {
    document.addEventListener("ui:dialog.open", (e) => {
      const dialogEl = /** @type {DialogComponent} dialogEl */ (e.target)
      if (!dialogEl.dockable) return

      const { id } = dialogEl

      if (dialogEl.minimizable) {
        dialogEl.minimize = () => {
          requestAnimationFrame(() => {
            this.minimize(id)
          })
        }

        dialogEl.unminimize = () => {
          requestAnimationFrame(() => {
            this.unminimize(id)
          })
        }

        const minimizeEl = render({
          tag: "button.ui-dialog__button.ui-dialog__button--minimize",
          picto: "minimize",
          aria: { label: "Minimize" },
          // onpointerdown: () => {
          //   dialogEl.activate()
          // },
          onclick: () => {
            dialogEl.minimize()
          },
        })

        const lastDialogButton = dialogEl.querySelector(
          ".ui-dialog__button--maximize, .ui-dialog__button--close",
        )

        if (lastDialogButton) {
          lastDialogButton.before(minimizeEl)
        } else {
          dialogEl.titleEl.after(minimizeEl)
        }
      }

      let inContextMenu = false
      const buttonEl = render(
        {
          tag: "button.ui-dock__button",
          id: true,
          content: getTitle(dialogEl),
          picto: dialogEl.picto,
          on: {
            "contextmenu": (e, target) => {
              if (e.pointerType === "touch") inContextMenu = true
              contextMenu(e, target)
            },
            "pointerdown || pointerup": (e, buttonEl) => {
              if (inContextMenu) {
                inContextMenu = false
                return
              }

              if (
                e.pointerType === "touch"
                  ? e.type === "pointerdown"
                  : e.type === "pointerup" || e.button !== 0
              ) {
                return
              }

              if (dialogEl.minimized) {
                requestAnimationFrame(() => {
                  this.unminimize(id)
                })
              } else if (buttonEl.ariaPressed === "true") {
                requestAnimationFrame(() => {
                  this.minimize(id)
                })
              } else {
                dialogEl.activate({ wiggle: true })
              }

              return false
            },
          },
        },
        this,
      )

      const { cancel, signal } = new Canceller()
      programs.set(id, { buttonEl, dialogEl, cancel, signal })

      let dblclickTimerId
      let contextMenuEl

      const contextMenu = async (e, target) => {
        clearTimeout(dblclickTimerId)
        await sleep(100)
        // console.log(444, e.button)

        if (dialogEl.closed) return
        if (Dragger.isDragging) return

        const fileMenu = async () => {
          if (!dialogEl.app?.manifest.decode) return
          const selection = []

          for (const item of dialogEl.app.files) {
            selection.push(item.path)
          }

          const content = await os.plans.makeOpenedFileContextMenu({
            selection,
            includeClipboardActions: false,
          })

          for (const item of content) {
            if (selection.length === 0) item.disabled = true
            delete item.shortcut
          }

          return {
            label: "File",
            disabled: selection.length === 0,
            content,
          }
        }

        const contextMenuConfig = os.config?.dock?.contextMenu
        const isDockMenu = target === buttonEl
        const configuredItems = Array.isArray(contextMenuConfig)
          ? contextMenuConfig
          : (contextMenuConfig?.[isDockMenu ? "dock" : "dialog"] ?? [])
        const definitions = {
          ...contextMenuConfig?.items,
          maximize: dialogEl.maximized
            ? {
                label: "Restore",
                picto: "restore",
                action: () => dialogEl.toggleMaximize(false),
              }
            : {
                label: "Maximize",
                picto: "maximize",
                disabled: !dialogEl.maximizable,
                action: () => dialogEl.toggleMaximize(true),
              },
          minimize: dialogEl.minimized
            ? {
                label: "Unminimize",
                picto: "minimize",
                action: () => this.unminimize(id),
              }
            : {
                label: "Minimize",
                picto: "minimize",
                disabled: !dialogEl.minimizable,
                action: () => this.minimize(id),
              },
          file: fileMenu,
          closeOthers: {
            label: "Close Others",
            disabled: programs.size < 2,
            action: () => {
              for (const { dialogEl: otherDialogEl } of programs.values()) {
                if (otherDialogEl === dialogEl) continue
                otherDialogEl.close()
              }
            },
          },
          close: {
            label: "Close",
            picto: "close",
            shortcut: "Ctrl+K",
            action: () => dialogEl.close(),
          },
        }
        const plan = await composeMenu(
          isDockMenu
            ? [
                "maximize",
                "minimize",
                "---",
                ...configuredItems,
                "---",
                "closeOthers",
                "close",
              ]
            : [...configuredItems, "---", "close"],
          definitions,
          dialogEl,
        )

        if (dialogEl.closed) return

        contextMenuEl = await menu(plan, { opener: dialogEl, of: e })
      }

      dialogEl.contextMenu = contextMenu

      on(
        { signal: dialogEl.signal, prevent: true },

        dialogEl.pictoEl,
        {
          contextmenu: contextMenu,
        },
        {
          pointerdown: (e, target) => {
            clearTimeout(dblclickTimerId)
            dblclickTimerId = setTimeout(() => {
              if (dialogEl.closed) return
              contextMenu(e, target)
            }, 150)
          },
        },
        {
          disrupt: true,
          dblclick: () => {
            contextMenuEl?.close()
            dialogEl.close()
          },
        },

        dialogEl.titleEl,
        { contextmenu: contextMenu },

        // buttonEl,
        // { contextmenu: contextMenu },
      )

      this.activate(id)
    })

    on({
      "signal": this.signal,

      "ui:dialog.title-change": ({ target }) => {
        if (!programs.has(target.id)) return
        const { buttonEl, dialogEl } = programs.get(target.id)
        if (!buttonEl) return
        buttonEl.children[dialogEl.picto ? 1 : 0].textContent = getTitle(target)
      },

      "ui:dialog.picto-change": ({ target }) => {
        if (!programs.has(target.id)) return
        const { buttonEl, dialogEl } = programs.get(target.id)
        if (!buttonEl || !dialogEl.picto) return
        buttonEl.children[0].value = target.picto
      },

      "ui:dialog.activate": ({ target }) => {
        if (!programs.has(target.id)) return
        this.activate(target.id)
      },

      "ui:dialog.close || ui:dialog.destroy": ({ target }) => {
        if (!programs.has(target.id)) return
        const buttonEl = programs.get(target.id)?.buttonEl
        programs.delete(target.id)
        buttonEl.remove()
      },
    })
  }
}

export const dock = Component.define(DockComponent)
