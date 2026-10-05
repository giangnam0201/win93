import { fs } from "/42/api/fs.js"
import { getDirname } from "/42/lib/syntax/path/getDirname.js"
import { getBasename } from "/42/lib/syntax/path/getBasename.js"
import { joinPath } from "/42/lib/syntax/path/joinPath.js"
import { dialog, alert, form } from "/42/ui/layout/dialog.js"
import { toast } from "/42/ui/layout/toast.js"
import { incrementFilename } from "/42/api/fs/incrementFilename.js"
import { getSortableDateTime } from "/42/lib/date/getSortableDateTime.js"
import { truncate } from "/42/lib/type/string/truncate.js"
import { fileIndex } from "/42/api/fileIndex.js"
import { normalizeDirname } from "/42/api/fs/normalizeFilename.js"
import { trashManager } from "/42/api/os/managers/trashManager.js"
import { extractArchive } from "./extractArchive.js"
import { compressArchive, compressionFormats } from "./compressArchive.js"
import {
  getArchiveBasename,
  readSelection,
  planExtraction,
} from "./archiveFiles.js"
import "/42/ui/control/pathpicker.js"

async function extractFile(source, parent, remove = false) {
  const path = typeof source === "string" ? source : source.path
  const name =
    typeof source === "string" ? getBasename(source) : source.getName()
  /** @type {HTMLProgressElement} */
  let progressEl
  /** @type {HTMLDivElement} */
  let labelEl
  const progressDialog = await dialog({
    label: `Extracting ${name}`,
    animation: false,
    skipSave: true,
    closable: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    width: 380,
    pivot: "center",
    content: {
      tag: ".rows.pa.gap-xs",
      content: [
        {
          tag: "div",
          content: "Reading archive…",
          created: (el) => {
            labelEl = el
          },
        },
        {
          tag: "progress.w-full",
          created: (el) => {
            progressEl = el
          },
        },
      ],
    },
    buttons: [],
  })

  let destination
  let error
  try {
    const buffer =
      typeof source === "string"
        ? await (await fs.open(source)).arrayBuffer()
        : await source.getArrayBuffer()
    const extracted = await extractArchive(new Uint8Array(buffer), name)
    const plan = planExtraction(extracted, name, parent ?? getDirname(path))
    destination = plan.destination
    const { entries } = plan
    await fs.writeDir(destination)

    progressEl.max = entries.length || 1
    progressEl.value = 0
    for (const entry of entries) {
      labelEl.textContent = `Saving ${entry.path}`
      const path = joinPath(destination, entry.path)
      await (entry.directory ? fs.writeDir(path) : fs.write(path, entry.data))
      progressEl.value++
    }
    if (remove) await trashManager.add(path)
  } catch (err) {
    error = err
  } finally {
    await progressDialog.close(true)
  }

  if (error) {
    await alert(
      `Could not extract ${name}.\n\n${error.message}` +
        (destination
          ? `\n\nIncomplete files may remain in ${destination}.`
          : ""),
      { label: "Archiver" },
    )
  } else {
    const destPath = destination
    await toast({
      label: "Archiver",
      // picto: "check",
      // timeout: false,
      message: {
        content: [
          `Extracted ${name} to `,
          {
            tag: "a",
            href: destPath,
            content: destPath,
          },
          ".",
        ],
      },
    })
  }
}

/** @param {import("42/api/os/App.js").App} app */
export function launchApp(app) {
  let pending = Promise.resolve()
  app.on("decode", (fileAgent) => {
    pending = pending
      .then(() => extractTo([fileAgent]))
      .catch((err) => alert(err, { label: "Archiver" }))
    const current = pending
    current.finally(() => {
      if (pending === current) app.destroy()
    })
  })
  if (app.files.length === 0) {
    app
      .openFile()
      .then((result) => {
        if (result === false) app.destroy()
      })
      .catch((err) => {
        alert(err, { label: "Archiver" })
        app.destroy()
      })
  }
}

function folderField(path) {
  return {
    tag: "ui-pathpicker",
    name: "folder",
    label: "Folder",
    directory: true,
    value: path,
  }
}

function validateFolder(folder) {
  if (!folder?.trim()) throw new Error("Choose a destination folder.")
  const path = normalizeDirname(folder)
  if (!fileIndex.isDir(path)) {
    throw new Error(`Folder does not exist: ${folder}`)
  }
  return path
}

async function extractTo(sources) {
  const first = sources[0]
  const path = typeof first === "string" ? first : first.path
  const result = await form([folderField(path ? getDirname(path) : "/a")], {
    label: "Extract to…",
    agree: "Extract",
    table: true,
  })
  if (!result) return
  const folder = validateFolder(result.folder)
  for (const source of sources) await extractFile(source, folder)
}

async function writeArchive(entries, destination, extension) {
  const data = await compressArchive(entries, extension)
  destination = incrementFilename(destination)
  await fs.write(destination, data)
  await toast({
    label: "Archiver",
    // picto: "check",
    // timeout: false,
    message: {
      content: [
        "Created ",
        { tag: "a", href: destination, content: destination },
        ".",
      ],
    },
  })
}

async function compressSelection(selection, destination, extension) {
  const progressDialog = await dialog({
    label: `Compressing ${getBasename(destination)}`,
    closable: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    skipSave: true,
    width: 380,
    content: {
      tag: ".rows.pa.gap-xs",
      content: ["Compressing…", { tag: "progress.w-full" }],
    },
    buttons: [],
  })
  try {
    await writeArchive(await readSelection(selection), destination, extension)
  } finally {
    await progressDialog.close(true)
  }
}

async function compressTo(selection) {
  const result = await form(
    [
      folderField(getDirname(selection[0])),
      {
        tag: "input",
        name: "name",
        label: "Name",
        value: getSortableDateTime({ seconds: true }),
        required: true,
      },
      {
        tag: "select",
        name: "type",
        label: "Type",
        value: "tar.gz",
        content: compressionFormats.map(({ label, extension }) => ({
          tag: "option",
          value: extension,
          selected: extension === "tar.gz",
          content: `${label} (.${extension})`,
        })),
      },
    ],
    { label: "Compress to…", agree: "Compress", table: true },
  )
  if (!result) return
  const folder = validateFolder(result.folder)
  if (
    !result.name?.trim() ||
    /[/\\\0]/u.test(result.name) ||
    [".", ".."].includes(result.name)
  ) {
    throw new Error("Enter a filename without slashes.")
  }
  await compressSelection(
    selection,
    joinPath(folder, `${result.name}.${result.type}`),
    result.type,
  )
}

async function convertArchives(selection, extension) {
  for (const path of selection) {
    const name = getBasename(path)
    const progressDialog = await dialog({
      label: `Converting ${name}`,
      closable: false,
      maximizable: false,
      minimizable: false,
      resizable: false,
      skipSave: true,
      width: 380,
      content: {
        tag: ".rows.pa.gap-xs",
        content: ["Converting…", { tag: "progress.w-full" }],
      },
      buttons: [],
    })
    try {
      const data = new Uint8Array(await (await fs.open(path)).arrayBuffer())
      const entries = await extractArchive(data, name)
      const destination = joinPath(
        getDirname(path),
        `${getArchiveBasename(name)}.${extension}`,
      )
      await writeArchive(entries, destination, extension)
    } finally {
      await progressDialog.close(true)
    }
  }
}

function menuAction(action) {
  return async () => {
    try {
      await action()
    } catch (err) {
      await alert(err, { label: "Archiver" })
    }
  }
}

/**
 * @param {import("/42/api/os/AppAgent.js").AppAgent} appAgent
 * @returns {import("/42/api/gui/render.js").PlanArray}
 */
export function renderContextMenu(appAgent) {
  const { selection } = appAgent
  if (selection.length === 0) return []
  const archives = appAgent.getSupportedFiles()

  const items = []

  if (archives.length > 0) {
    items.push({
      label: "Extract",
      content: [
        {
          label: "Extract here",
          action: menuAction(async () => {
            for (const path of archives) await extractFile(path)
          }),
        },
        {
          label: "Extract here and delete archive",
          action: menuAction(async () => {
            for (const path of archives) {
              await extractFile(path, undefined, true)
            }
          }),
        },
        {
          label: "Extract to…",
          action: menuAction(() => extractTo(archives)),
        },
        {
          label: "Convert to",
          content: compressionFormats.map(({ label, extension }) => ({
            label: `${label} (.${extension})`,
            action: menuAction(() => convertArchives(archives, extension)),
          })),
        },
      ],
    })
  }

  if (selection.length > 1 || archives.length === 0) {
    const basename =
      selection.length === 1
        ? getBasename(selection[0])
        : getSortableDateTime({ seconds: true })

    items.push({
      label: "Compress",
      content: [
        ...["tar.gz", "zip"].map((extension) => {
          const destination = incrementFilename(
            joinPath(getDirname(selection[0]), `${basename}.${extension}`),
          )
          return {
            label: `Compress to ${truncate(getBasename(destination), { center: true, max: 60 })}`,
            action: menuAction(() =>
              compressSelection(selection, destination, extension),
            ),
          }
        }),
        {
          label: "Compress to…",
          action: menuAction(() => compressTo(selection)),
        },
      ],
    })
  }

  return items
}
