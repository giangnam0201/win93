import "../../ui/control/colorpicker.js"
import { fileIndex } from "../../api/fileIndex.js"
import { loadText } from "../../api/load/loadText.js"
import { cssVar } from "../../lib/cssom/cssVar.js"
import { getStemname } from "../../lib/syntax/path/getStemname.js"
import { toTitleCase } from "../../lib/type/string/transform.js"
import { importWindowsTheme } from "./windows9x/importWindowsTheme.js"

const IMAGES_KEYS = [
  "addon-bg-image",

  "inset-bdi-url",
  "button-bdi-url",
  "outset-bdi-url",
  "outset-shallow-bdi-url",
  "tabs__tab-bdi-url",

  "button-toggled-bdi-url",
  "button-active-bdi-url",
  "button-default-bdi-url",
  "fieldset-bdi-url",
  "radio-bdi-url",

  "button-arrow-top-bdi-url",
  "button-arrow-bottom-bdi-url",
  "button-arrow-left-bdi-url",
  "button-arrow-right-bdi-url",

  "disabled-filter",
  "scrollbar-sprites-url",
]

const IMAGES_COLORS = {
  ButtonFace: "rgb(212 208 200)",
  ButtonText: "rgb(0 0 0)",
  ButtonDkShadow: "rgb(64 64 64)",
  ButtonShadow: "rgb(128 128 128)",
  ButtonLight: "rgb(223 223 223)",
  ButtonHilight: "rgb(255 255 255)",
}

const IMAGES = {}

const COLORS = {
  ActiveTitle: true,
  GradientActiveTitle: true,
  TitleText: true,

  InactiveTitle: true,
  GradientInactiveTitle: true,
  InactiveTitleText: true,

  ButtonAlternateFace: true,
  ButtonDkShadow: true,
  ButtonFace: true,
  ButtonHilight: true,
  ButtonLight: true,
  ButtonShadow: true,
  ButtonText: true,

  Background: true,
  Window: true,
  WindowFrame: true,
  WindowText: true,
  AppWorkspace: true,
  Scrollbar: true,

  Menu: true,
  MenuBar: true,
  MenuHilight: true,
  MenuText: true,

  InfoText: true,
  InfoWindow: true,

  GrayText: true,
  Hilight: true,
  HilightText: true,
  HotTrackingColor: true,

  ActiveBorder: true,
  InactiveBorder: true,
}

const cssText = await loadText(import.meta.resolve("./windows9x.theme.css"))

for (const { groups } of cssText.matchAll(
  new RegExp(
    `--(?<key>${IMAGES_KEYS.join("|")})\\s*:\\s*(?<image>.*)\\s*;\n`,
    "g",
  ),
)) {
  IMAGES[groups.key] = groups.image
}

function replaceColors(str, colors) {
  for (const [key, val] of Object.entries(IMAGES_COLORS)) {
    if (colors[`--${key}`]) {
      str = str.replaceAll(val, colors[`--${key}`])
    }
  }
  return str
}

export function refreshTheme(theme) {
  const { properties } = theme
  for (const [key, val] of Object.entries(IMAGES)) {
    properties[`--${key}`] = replaceColors(val, properties)
  }
}

export async function configureTheme(theme) {
  return importWindowsTheme(theme.config.scheme)
}

export async function getThemePlans(theme) {
  const content = [["Current", theme.config.scheme]]

  for (const path of fileIndex.glob("**/*.theme", "i")) {
    const name = toTitleCase(getStemname(path))
    content.push([name, path])
  }

  return {
    settings: {
      tag: "select",
      content,
      value: theme.config.scheme,
      oninput: async (e) => {
        if (!e.target.value) return
        console.log(e.target.value)
        await theme.configure({ scheme: e.target.value })
      },
    },
    colors: {
      tag: ".datatable.ma-xs.fit",
      content: {
        tag: "table.striped.w-full",
        content: [
          [
            { tag: "th", content: "Name" },
            { tag: "th", content: "Color" },
          ],

          ...Object.entries(COLORS).map(([key, val]) => {
            const id = `theme-colorpicker-${key}`
            const property = `--${key}`
            return [
              { tag: "label", for: id, content: val === true ? key : val },
              {
                tag: "ui-colorpicker",
                id,
                dataset: { property },
                value: cssVar.get(property),
              },
              // { tag: "color", id, value: cssVar.get(key) },
            ]
          }),
        ],
      },
    },
  }
}
