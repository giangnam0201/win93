import { getBasename } from "../../lib/syntax/path/getBasename.js"
import { getDirname } from "../../lib/syntax/path/getDirname.js"
import { joinPath } from "../../lib/syntax/path/joinPath.js"
import { parsePath } from "../../lib/syntax/path/parsePath.js"
import { explorer } from "../../ui/desktop/explorer.js"
import { alert, confirm, prompt } from "../../ui/layout/dialog.js"
import { logger } from "../logger.js"
import { clipboard } from "../io/clipboard.js"
import { fileIndex } from "../fileIndex.js"
import { fs } from "../fs.js"
import { io } from "../io.js"
import { normalizeDirname, normalizeFilename } from "../fs/normalizeFilename.js"
import { incrementFilename } from "../fs/incrementFilename.js"
import { appsManager } from "./managers/appsManager.js"
import { trashManager } from "./managers/trashManager.js"
import { fileClipboard } from "./fileClipboard.js"

// MARK: movePath
export async function movePath(selection, dest, options) {
  dest = normalizeDirname(dest)
  const out = []
  for (let from of [selection].flat()) {
    from = normalizeFilename(from)
    const to = dest + getBasename(from)
    out.push(fs.move(from, to, options).then(() => to))
  }
  return Promise.all(out)
}

// MARK: copyPath
export async function copyPath(selection, dest, options) {
  dest = normalizeDirname(dest)
  const out = []
  for (let from of [selection].flat()) {
    from = normalizeFilename(from)
    // const to = dest + getBasename(from)
    let to = dest + getBasename(from)
    if (normalizeDirname(getDirname(from)) === dest) {
      to = incrementFilename(to)
    }
    out.push(fs.copy(from, to, options).then(() => to))
  }
  return Promise.all(out)
}

// MARK: deletePaths
export async function deletePaths(selection) {
  if (!selection) return
  const out = []
  for (const path of [selection].flat()) {
    out.push(
      path.endsWith("/")
        ? fs.deleteDir(normalizeDirname(path))
        : fs.delete(normalizeFilename(path)),
    )
  }
  return Promise.all(out)
}

// MARK: createPath
export async function createPath(path = "/", options) {
  if (path.endsWith("/")) {
    path +=
      options?.suggestedName ?? (options?.folder ? "untitled" : "untitled.txt")
  }

  const value = getBasename(incrementFilename(path))
  path = normalizeDirname(getDirname(path))

  async function promptUser(value) {
    let messageEl
    let agreeEl
    const name = await prompt("Enter the name", {
      label: options?.folder ? "Create Folder" : "Create File",
      value,
      afterfield: {
        tag: ".message.ma-y-sm",
        role: "status",
        aria: { live: "polite" },
        content: "",
      },
      field: {
        prose: false,
        renamable: options?.suggestedName ? true : { firstFragment: "base" },
        on: {
          async input({ target }) {
            agreeEl ??= target
              .closest("ui-dialog")
              ?.querySelector(".ui-dialog__agree")

            messageEl ??= target.nextElementSibling
            const name = target.value
            messageEl.classList.toggle("info", false)
            messageEl.classList.toggle("negative", false)
            messageEl.classList.toggle("warning", false)
            // message.setAttribute("aria-live", "off")

            agreeEl.disabled = false

            if (name.startsWith(".")) {
              if (name === "." || name === "..") {
                messageEl.classList.toggle("negative", true)
                messageEl.textContent = `The name ‘${name}’ is reserved for system use.` //  Please provide an alternative.
                agreeEl.disabled = true
              } else {
                messageEl.classList.toggle("warning", true)
                messageEl.textContent =
                  "If the name starts with a dot it will be hidden by default."
              }
            } else if (name.includes("/")) {
              messageEl.classList.toggle("info", true)
              messageEl.textContent =
                "Using slashes in name will create sub-folders."
            } else if (name.includes("\\")) {
              messageEl.classList.toggle("negative", true)
              messageEl.textContent = "The name cannot include a backslash."
              agreeEl.disabled = true
            } else {
              messageEl.textContent = ""
            }
          },
        },
      },
    })

    if (name === "." || name === "..") {
      await alert(`The name ‘${name}’ is reserved for system use`, {
        icon: "error",
        label: "Error",
      })
      return promptUser(name)
    }

    if (name?.includes("\\")) {
      await alert("The name cannot include a backslash", {
        icon: "error",
        label: "Error",
      })
      return promptUser(name)
    }

    return name
  }

  const name = await promptUser(value)

  if (name) {
    let filename = path + name

    if (options?.folder) {
      filename += "/"
      options?.onFilename?.(filename)
      await fs.writeDir(filename)
    } else {
      options?.onFilename?.(filename)
      await fs.writeText(filename, "")
    }

    return filename
  }
}

// MARK: createFile
export async function createFile(path, options) {
  return createPath(path, options)
}

createFile.meta = {
  label: "Create File…",
  picto: "file-new",
  shortcut: "F9",
}

// MARK: createFolder
export async function createFolder(path, options) {
  return createPath(path, { ...options, folder: true })
}

createFolder.meta = {
  label: "Create Folder…",
  picto: "folder-new",
  shortcut: "F10",
}

// MARK: createShortcut
let chooseOtherApp
export async function createShortcut(path, options) {
  chooseOtherApp ??= await import("./plans.js").then(
    ({ chooseOtherApp }) => chooseOtherApp,
  )
  return new Promise((resolve) => {
    chooseOtherApp(undefined, async (appName) => {
      import("./managers/appsManager.js").then(({ appsManager }) => {
        const filename = appsManager.writeDesktopIcon(path, appName)
        options?.onFilename?.(filename)
        resolve(filename)
      })
    })
  })
}

createShortcut.meta = {
  label: "Create Shortcut…",
  picto: "plus",
  shortcut: "F8",
}

// MARK: deleteFile
export async function deleteFile(selection) {
  selection = [selection].flat()
  const len = selection.length
  if (len === 0) return
  const ok = await confirm({
    message: {
      tag: ".ok",
      content: [
        `%md \
Do you really want to **permanently delete** ${
          len === 1 ? "this item" : `these ${len} items`
        }?  \n`,
      ],
    },
    icon: "warning",
    agree: "Delete Permanently",
  })
  if (!ok) return
  return deletePaths(selection)
}

deleteFile.meta = {
  label: "Delete File",
  picto: "trash",
  shortcut: "Shift+Del",
}

// MARK: deleteFolder
export async function deleteFolder(selection) {
  return deleteFile(selection)
}

deleteFolder.meta = {
  label: "Delete Folder",
  picto: "trash",
  shortcut: "Shift+Del",
}

// MARK: moveFileToTrash
export async function moveFileToTrash(selection) {
  await Promise.all([selection].flat().map((path) => trashManager.add(path)))
}

moveFileToTrash.meta = {
  label: "Move to Trash",
  picto: "trash",
  shortcut: "Del",
}

// MARK: moveFolderToTrash
export async function moveFolderToTrash(selection) {
  return moveFileToTrash(selection)
}

moveFolderToTrash.meta = {
  label: "Move to Trash",
  picto: "trash",
  shortcut: "Del",
}

// MARK: launchFile
export async function launchFile(selection) {
  return appsManager.open(selection)
}

launchFile.meta = {
  label: "Open File…",
  picto: "window",
}

// MARK: launchFolder
export async function launchFolder(selection) {
  return appsManager.open(selection)
}

launchFolder.meta = {
  label: "Open Folder…",
  picto: "window",
}

// MARK: renameFile
export async function renameFile(selection) {
  const path = selection?.[0]
  if (!path || !fileIndex.has(path)) return
  const parsed = parsePath(path)
  const newName = await prompt("Enter the new name", {
    value: parsed.base,
    field: { prose: false, renamable: true },
  })
  if (!newName) return
  const newPath = `${parsed.dir === "/" ? "" : parsed.dir}/${newName}`

  fileIndex.move(path, newPath)
}

renameFile.meta = {
  label: "Rename…",
  picto: "input",
  shortcut: "F2",
}

// MARK: renameFolder
export async function renameFolder(selection) {
  return renameFile(selection)
}

// MARK: exportFile
export async function exportFile(selection, options = {}) {
  options.legacy ??= true // Prevent browser confirmation

  for (const path of selection) {
    try {
      const file = await fs.open(path)
      await io.fileExport(file, options)
    } catch {}
  }
}

exportFile.meta = {
  label: "Export File…",
  picto: "export",
}

const isUserCancelError = (err) =>
  err === "User cancelled" ||
  err?.message === "User cancelled" ||
  err?.name === "AbortError"

// MARK: exportFolder
export async function exportFolder(selection, options = {}) {
  const { createFolderTarball } = await import("./createFolderTarball.js")
  const { getBasename } = await import("../../lib/syntax/path/getBasename.js")
  const { dialog } = await import("../../ui/layout/dialog.js")

  for (const path of selection) {
    if (!path.endsWith("/")) continue
    try {
      const folderName = getBasename(path)
      const ac = new AbortController()

      const { readable, writable } = new TransformStream()

      /** @type {any} */
      const progressDialog = await dialog({
        label: `Exporting ${folderName}`,
        animation: false,
        skipSave: true,
        pivot: "center",
        on: {
          "ui:dialog.close": ({ detail }) => {
            if (detail.ok) return
            const reason = new DOMException("User cancelled", "AbortError")
            try {
              ac.abort(reason)
            } catch {}
            if (!writable.locked) writable.abort(reason).catch(() => {})
          },
        },
        content: [
          {
            tag: ".rows.pa.gap-xs",
            style: { width: "300px", maxWidth: "100%" },
            content: [
              { id: "compressingLabel", content: "Exporting..." },
              { tag: "progress.w-full", id: "progress" },
            ],
          },
        ],
        buttons: [
          {
            label: "Cancel",
            onclick: (e) => e.target.closest("ui-dialog").close(),
          },
        ],
      })

      // await sleep(200)

      const exportPromise = io.fileExport(readable, {
        ...options,
        suggestedName: folderName + ".tar",
        async onExportStart() {
          void createFolderTarball(path, {
            // includeURLFiles: true,
            signal: ac.signal,
            ...options,
          })
            .then((tarStream) =>
              tarStream.pipeTo(writable, { signal: ac.signal }),
            )
            .catch((err) => {
              if (isUserCancelError(err)) return
              ac.abort(err)
              if (!writable.locked) writable.abort(err).catch(() => {})
            })
        },
      })

      try {
        await exportPromise
      } catch (err) {
        if (!isUserCancelError(err)) throw err
      } finally {
        if (progressDialog) progressDialog.close(true)
      }
    } catch {}
  }
}

exportFolder.meta = {
  label: "Export Folder…",
  picto: "export",
}

// MARK: importFile
export async function importFile(path = "/", options = {}) {
  options.id ??= (options?.idPrefix ?? "") + path

  const files = await io.fileImport(options)

  if (!files) return

  const out = []
  const undones = []

  for (const file of files) {
    const filename = joinPath(path, file.webkitRelativePath || file.name)
    out.push(filename)
    options?.onFilename(filename)
    undones.push(fs.write(filename, file))
  }

  await Promise.allSettled(undones)

  return out
}

importFile.meta = {
  label: "Import File…",
  picto: "import",
}

// MARK: copyFile
export async function copyFile(selection) {
  fileClipboard.copy(selection)
}

copyFile.meta = {
  label: "Copy",
  picto: "copy",
  shortcut: "Ctrl+C",
}

// MARK: cutFile
export async function cutFile(selection) {
  fileClipboard.cut(selection)
}

cutFile.meta = {
  label: "Cut",
  picto: "cut",
  shortcut: "Ctrl+X",
}

// MARK: pasteTo
export async function pasteTo(path, folderEl) {
  fileClipboard.pasteTo(path, folderEl)
}

pasteTo.meta = {
  label: "Paste",
  picto: "clipboard",
  shortcut: "Ctrl+V",
}

// MARK: copyLocation
export async function copyLocation(selection, options) {
  options ??= { notif: true }
  if (selection.length === 0) return
  if (selection.length === 1) clipboard.copy(selection[0], options)
  else clipboard.copy(JSON.stringify(selection), options)
}

copyLocation.meta = {
  label: "Copy Location",
  picto: "copy",
}

// MARK: openContainingFolder
export async function openContainingFolder(selection) {
  const folders = new Set()

  for (const item of selection) {
    if (item.endsWith(".desktop")) logger.log(item)
    folders.add(getDirname(item))
  }

  for (const item of folders) {
    explorer(item, { selection })
  }
}

openContainingFolder.meta = {
  label: "Open Containing Folder…",
  picto: "folder-open",
}

export const actions = {
  createPath,
  createFile,
  createFolder,
  createShortcut,
  deleteFile,
  deleteFolder,
  moveFileToTrash,
  moveFolderToTrash,
  cutFile,
  copyFile,
  pasteTo,
  launchFile,
  launchFolder,
  renameFile,
  renameFolder,
  exportFile,
  exportFolder,
  importFile,
  movePath,
  copyPath,
  copyLocation,
  openContainingFolder,
}
