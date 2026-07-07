import { ConfigFile } from "../ConfigFile.js"
import { getBasename } from "../../../lib/syntax/path/getBasename.js"
import { fs } from "../../fs.js"
import { fileIndex } from "../../fileIndex.js"
import { incrementFilename } from "../../fs/incrementFilename.js"
import { confirm } from "../../../ui/layout/dialog.js"
import { toast } from "../../../ui/layout/toast.js"
import { render } from "../../gui/render.js"
import { removeItem } from "../../../lib/type/array/removeItem.js"
import { explorer } from "../../../ui/desktop/explorer.js"
import { segmentize } from "../../../lib/type/string/segmentize.js"
import { normalizeFilename } from "../../fs/normalizeFilename.js"

const DEFAULTS = {
  infos: {},
}

function warnExists(path) {
  toast(`Impossible to restore, a file named ‘${path}’ already exists.`, {
    icon: "error",
  })
}

class TrashManager extends ConfigFile {
  icon

  iconPlan = {
    id: "trash-icon",
    picto: "user-trash",
    command: "/trash/",
    value: "/trash/",
    label: "Trash",
  }

  isEmpty() {
    return this.value.infos //
      ? Object.keys(this.value.infos).length === 0
      : true
  }

  getIcon() {
    if (this.icon) return
    this.icon = document.querySelector("#trash-icon")
    this.icon?.ready.then(() => this.updateIcon())
  }

  updateIcon() {
    this.icon = document.querySelector("#trash-icon")
    if (this.icon) {
      this.iconPlan.picto = this.isEmpty() ? "user-trash" : "user-trash-full"
      this.icon.picto = this.iconPlan.picto
    }
  }

  #register(path) {
    let name = getBasename(path)
    if (name in this.value.infos) {
      name = incrementFilename(name, { data: this.value.infos })
    }
    this.value.infos[name] = { path, deleted: Date.now() }
    this.updateIcon()
    this.save()
    return name
  }

  async add(path) {
    if (path.startsWith("/trash/")) return
    await this.ready
    path = normalizeFilename(path)
    const name = this.#register(path)
    await fs.move(path, `/trash/${name}`, { silent: true })
  }

  async restore(nameOrPath, options) {
    await this.ready
    const name = getBasename(nameOrPath)
    if (name in this.value.infos === false) {
      const segments = segmentize(nameOrPath, "/")
      if (segments[0] === "trash") segments.shift()
      if (segments[0] in this.value.infos === false) return
      const folderPath = this.value.infos[segments[0]]?.path
      if (!folderPath) return
      segments.shift()
      const newPath = folderPath + "/" + segments.join("/")
      await fs.move(nameOrPath, newPath, { silent: true })
      return
    }
    const { path } = this.value.infos[name]
    if (await fs.access(path)) {
      if (options?.silent !== true) warnExists(path)
      return
    }
    delete this.value.infos[name]
    this.updateIcon()
    this.save()
    await fs
      .move(`/trash/${name}`, path, { silent: true })
      .catch((err) => console.log("trashManager.restore() ->", err.message))
  }

  async restoreAll(options) {
    const entries = Object.entries(this.value.infos)
    const duplicates = new Set()
    const paths = new Set()
    const undones = []
    for (let i = entries.length - 1; i >= 0; i--) {
      const [name, { path }] = entries[i]
      if (paths.has(path)) {
        duplicates.add(path)
        continue
      }
      paths.add(path)
      undones.push(this.restore(name))
    }

    if (options?.silent !== true) {
      for (const path of duplicates) warnExists(path)
    }

    await Promise.all(undones)
  }

  async empty(options) {
    if (options?.confirm) {
      const ok = await confirm(
        `%md Do you want to **permanently delete** all items from the Trash?`, // This action cannot be undone.
        {
          icon: "warning",
          agree: "Empty Trash",
        },
      )
      if (!ok) return
    }
    await this.ready
    const names = Object.keys(this.value.infos)
    this.value.infos = {}
    this.save()
    await Promise.all(
      names.map(async (name) => {
        const path = `/trash/${name}`
        try {
          await (fileIndex.isFile(path) ? fs.delete(path) : fs.deleteDir(path))
        } catch (err) {
          console.log("trashManager.empty() ->", err.message)
        }
      }),
    )

    window.dispatchEvent(new CustomEvent("ui:trash.empty"))
    this.updateIcon()
  }

  async init() {
    await super.init()
    this.getIcon()
    this.value.infos ??= {}

    fs.on("move || copy", (from, to) => {
      if (from.startsWith("/trash/")) {
        for (const [key, { path }] of Object.entries(this.value.infos)) {
          console.log(key, path)
          if (from === path) {
            delete this.value.infos[key]
          }
        }
        return
      }

      if (!to.startsWith("/trash/")) return

      this.#register(from)
    })

    document.addEventListener("ui:explorer.navigate", (e) => {
      e.target.removeTrashButtons?.()
      if (e.target.value.startsWith("/trash/")) {
        const res = render([
          {
            tag: "button",
            picto: "check",
            content: "Restore all",
            disabled: () => this.isEmpty(),
            action: () => this.restoreAll({ confirm: true }),
          },
          {
            tag: "button",
            picto: "cross",
            content: "Empty Trash",
            disabled: () => this.isEmpty(),
            action: () => this.empty({ confirm: true }),
          },
        ])
        const buttons = [...res.children]
        e.target.removeTrashButtons = () =>
          buttons.forEach((btn) => btn.remove())
        e.target.navEl.after(res)
      }
    })

    document.addEventListener("ui:menu.items", (e) => {
      const { openerEl } = e.target
      if (!openerEl) return

      let inContextMenuTrashFolder
      if (openerEl.value?.startsWith("/trash/")) {
        if (openerEl.localName === "ui-folder") {
          inContextMenuTrashFolder = true
        } else {
          const remove = []
          for (const item of e.detail.items) {
            const { label } = item
            if (!label) continue
            if (label.startsWith("Rename")) {
              remove.push(item)
            }
          }
          for (const item of remove) removeItem(e.detail.items, item)
          const folderEl = openerEl.closest("ui-folder")
          e.detail.items.unshift(
            {
              label: "Restore",
              picto: "check",
              action: () => {
                for (const path of folderEl.selection) this.restore(path)
              },
            },
            "---",
          )
        }
      }

      const inTrashIcon = openerEl.id === "trash-icon"

      if (inContextMenuTrashFolder || inTrashIcon) {
        const remove = []
        for (const item of e.detail.items) {
          const { label } = item
          if (!label) continue
          if (label.startsWith("Create") || label.startsWith("Import")) {
            remove.push(item)
          }
        }
        for (const item of remove) removeItem(e.detail.items, item)
        e.detail.items.unshift(
          {
            label: "Empty Trash",
            picto: "cross",
            disabled: () => this.isEmpty(),
            action: () => this.empty({ confirm: true }),
          },
          {
            label: "Restore all",
            picto: "check",
            disabled: () => this.isEmpty(),
            action: () => this.restoreAll(),
          },
          "---",
        )

        if (inTrashIcon) {
          e.detail.items.unshift(
            {
              label: "Open Trash…",
              picto: "window",
              action: () => explorer("/trash/"),
            },
            "---",
          )
        }
      }
    })
  }
}

export const trashManager = new TrashManager("config/trash.json5", DEFAULTS)
trashManager.init()
