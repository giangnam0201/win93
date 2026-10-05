import { fileIndex } from "../../../../42/api/fileIndex.js"
import { fs } from "../../../../42/api/fs.js"
import { clipboard } from "../../../../42/api/io/clipboard.js"
import { getStemname } from "../../../../42/lib/syntax/path/getStemname.js"
import { randomItem } from "../../../../42/lib/type/array/randomItem.js"
import { slugify } from "../../../../42/lib/type/string/slugify.js"
import { picto } from "../../../../42/ui/media/picto.js"
import { mutations, mutationsLower } from "./js/mutations.js"
import { figlet } from "./js/figlet.js"
import { zalgo } from "./js/zalgo.js"
import { removeItem } from "../../../../42/lib/type/array/removeItem.js"
import { toast } from "../../../../42/ui/layout/toast.js"

let allMutationsKeys
const allMutations = {
  "random": (text) => {
    if (!allMutationsKeys) {
      allMutationsKeys = Object.keys(allMutations)
      removeItem(allMutationsKeys, "flag")
    }

    return text
      .split("")
      .map(
        (c) =>
          mutateChars(c, allMutations[randomItem(allMutationsKeys)]).result,
      )
      .join("")
  },
  "cursed": undefined,
  zalgo,
  "rotate": (text) =>
    mutateChars(text.split("").reverse().join(""), mutations["upside-down"])
      .result,
  "upside-down": undefined,
  "reverse": (text) => text.split("").reverse().join(""),
  "random-case": (text) =>
    text
      .split("")
      .map((c) => (Math.random() > 0.5 ? c.toLowerCase() : c.toUpperCase()))
      .join(""),
  "alternating-lower-first": (text) => {
    let result = ""
    let lower = true
    for (const ch of text) {
      result += lower ? ch.toLowerCase() : ch.toUpperCase()
      if (ch.match(/[a-z]/i)) lower = !lower
    }

    return result
  },
  "alternating-upper-first": (text) => {
    let result = ""
    let lower = false
    for (const ch of text) {
      result += lower ? ch.toLowerCase() : ch.toUpperCase()
      if (ch.match(/[a-z]/i)) lower = !lower
    }

    return result
  },
  "lowercase": (text) => text.toLowerCase(),
  "uppercase": (text) => text.toUpperCase(),
  ...mutations,
}

const randomFunctions = new Set(["zalgo", "random-case", "random"])
const mutationOptions = {
  zalgo: (mutateOptions, render) => {
    const inputEl = document.createElement("input")
    inputEl.type = "number"
    inputEl.name = "intensity"
    inputEl.value = "30"
    inputEl.min = "0"
    inputEl.max = "100000"
    inputEl.oninput = () => {
      mutateOptions.intensity = Number(inputEl.value)
      render()
    }

    return inputEl
  },
}

const textareaEl = document.querySelector("textarea")
const selectEl = document.querySelector("select")
const outputEl = document.querySelector("#output")

const mutationsOptions = document.querySelector('optgroup[label="Mutations"]')
const figletsOptions = document.querySelector('optgroup[label="Figlets"]')

function mutateChars(text, map) {
  let isRandom = false
  let result = ""

  for (const char of text) {
    if (map[char]) {
      if (Array.isArray(map[char])) {
        isRandom = true
        result += randomItem(map[char]) + "\uFE0E"
      } else {
        result += map[char] + "\uFE0E"
      }
    } else result += char
  }

  return { result, isRandom }
}

function makeLine(name, mutate, options) {
  const type = options?.type ?? ""
  const returnElement = options?.returnElement ?? false

  const value = mutationsLower.includes(name)
    ? textareaEl.value.toLowerCase()
    : textareaEl.value

  const div = document.createElement("div")
  const buttons = document.createElement("div")
  buttons.className = "result-buttons cols"
  div.className = `${slugify(name)}-result result ${type} flex relative inset document-style`

  const span = document.createElement("span")
  span.className = "smooth-font inline-block scroll-x-auto pa"
  div.append(span)

  let mutateOptions
  let result
  let isRandom

  function render() {
    if (typeof mutate === "function") {
      result = mutate(value, mutateOptions)
      isRandom = randomFunctions.has(name)
    } else {
      const res = mutateChars(value, mutate)
      result = res.result
      isRandom = res.isRandom
    }

    span.textContent = result
  }

  render()

  if (name in mutationOptions) {
    mutateOptions = {}
    buttons.append(mutationOptions[name](mutateOptions, render))
  }

  if (isRandom) {
    const randomEl = document.createElement("button")
    randomEl.title = "Randomize"
    randomEl.append(picto("arrow-cw"))
    randomEl.onclick = render
    buttons.append(randomEl)
  }

  if (options?.addPin) {
    const labelEl = document.createElement("span")
    const pinEl = document.createElement("button")
    pinEl.title = "Select"
    buttons.append(pinEl)
    labelEl.textContent = name
    pinEl.append(labelEl, picto("pin"))
    pinEl.onclick = () => {
      selectEl.value = name
      renderLines()
    }
  }

  const sourceEl = document.createElement("button")
  buttons.append(sourceEl)
  sourceEl.title = "Add as source text"
  sourceEl.append(picto("arrow-stop-up"))
  sourceEl.onclick = () => {
    textareaEl.value = result
    textareaEl.focus()
    renderLines()
  }

  const copyEl = document.createElement("button")
  buttons.append(copyEl)
  copyEl.title = "Copy to clipboard"
  copyEl.append(picto("clipboard"))
  copyEl.onclick = () => clipboard.copy(result, { notif: toast })

  div.append(buttons)

  if (returnElement) return div
  outputEl.append(div)
}

const figletFonts = {}
const figletFontFiles = fileIndex.glob("**/*.{flf,tlf}") // .slice(3, 4)
for (const path of figletFontFiles) {
  const name = getStemname(path)
  figletsOptions.append(new Option(name))
  figletFonts[name] = { name, path }
}

for (const key in allMutations) {
  if (Object.hasOwn(allMutations, key)) {
    mutationsOptions.append(new Option(key))
  }
}

function renderFiglet(key, options) {
  const { path, name, font } = figletFonts[key]

  if (font) {
    makeLine(name, (text) => figlet.generateText(font, font.options, text), {
      ...options,
      type: "figlet-result",
    })
  } else {
    const placeholder = document.createComment("FIGLET_PLACEHOLDER")
    outputEl.append(placeholder)

    fs.readText(path).then((res) => {
      try {
        figletFonts[key].font = figlet.parseFont(res)
        const { font } = figletFonts[key]
        placeholder.replaceWith(
          makeLine(
            name,
            (text) => figlet.generateText(font, font.options, text),
            { ...options, type: "figlet-result", returnElement: true },
          ),
        )
      } catch {}
    })
  }
}

async function renderLines() {
  outputEl.replaceChildren()

  if (selectEl.value === "All Mutations") {
    for (const key in allMutations) {
      if (Object.hasOwn(allMutations, key)) {
        makeLine(key, allMutations[key], { addPin: true })
      }
    }
  } else if (selectEl.value === "All Figlets") {
    for (const key in figletFonts) {
      if (Object.hasOwn(figletFonts, key)) {
        renderFiglet(key, { addPin: true })
      }
    }
  } else if (selectEl.value in figletFonts) {
    renderFiglet(selectEl.value)
  } else if (selectEl.value in allMutations) {
    makeLine(selectEl.value, allMutations[selectEl.value])
  }
}

textareaEl.addEventListener("input", renderLines)
selectEl.addEventListener("input", renderLines)

renderLines()
