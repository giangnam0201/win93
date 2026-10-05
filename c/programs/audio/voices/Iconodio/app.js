import { fileIndex } from "../../../../../42/api/fileIndex.js"
import { loadScript } from "../../../../../42/api/load/loadScript.js"
import { getIconFromPath } from "../../../../../42/api/os/managers/iconsManager/getIconFromPath.js"

const iconsPaths = await Promise.all([
  // add os icons
  ...fileIndex.glob([
    "/c/programs/**/{icon,icon-32,icon-16}.{png,gif}",
    "/c/users/windows93/interface/icons/32x32/**/*.{png,gif}",
    navigator.serviceWorker?.controller
      ? "/42/assets/icons/**/*.{png,gif}"
      : undefined,
  ]),

  // add desktop icons
  ...fileIndex
    .readDir("/c/users/windows93/desktop/", {
      absolute: true,
    })
    .map((path) => getIconFromPath(path).then(({ image }) => image)),
])

// remove doubles
window.iconsURL = [...new Set(iconsPaths)]

await loadScript("./sketch.js")
await loadScript("/c/libs/p5/1.11/p5.min.js")
