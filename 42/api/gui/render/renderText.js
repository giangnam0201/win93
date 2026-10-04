import { Markdown } from "../../../formats/language/Markdown.js"
const tmp = document.createElement("div")

/**
 * @param {HTMLElement} el
 * @param {string} plan
 */
export function renderText(el, plan) {
  if (plan === "---") {
    el.append(document.createElement("hr"))
    return el
  }

  if (plan.startsWith("%md ")) {
    const html = Markdown.compile(plan.slice(3)).replaceAll(/>\n+</g, "><")
    tmp.innerHTML = html

    // @ts-ignore
    if (tmp.childNodes.length === 1 && tmp.firstChild.localName === "p") {
      el.append(...tmp.firstChild.childNodes)
    } else el.append(...tmp.childNodes)
  } else if (el.localName === "button" || el.localName === "label") {
    const span = document.createElement("span")
    span.textContent = plan
    el.append(span)
  } else {
    el.append(plan)
  }

  return el
}

// // import { parseTemplate } from "../../../lib/syntax/template/parseTemplate.js"
// // import { Markdown } from "../../../formats/language/Markdown.js"

// /**
//  * @param {HTMLElement | SVGElement} el
//  * @param {string} plan
//  * @param {any} [stage]
//  */
// export function renderText(el, plan, stage) {
//   if (plan === "---") return void el.append(document.createElement("hr"))

//   if (stage?.plugins?.includes("markdown")) {
//     import("../../../formats/language/Markdown.js").then(({ Markdown }) => {
//       const div = document.createElement("div")
//       const html = Markdown.compile(plan).replaceAll(/>\n+</g, "><")
//       div.innerHTML = html
//       if (div.childNodes.length > 1) el.append(...div.childNodes)
//       else el.append(...div.firstChild.childNodes)
//     })
//     return
//   }

//   el.append(plan)

//   // const { strings, substitutions } = parseTemplate(plan)
//   // if (substitutions.length === 0) el.append(plan)
//   // else {
//   //   el.append(strings[0])
//   //   for (let i = 0, l = substitutions.length; i < l; i++) {
//   //     const text = new Text()
//   //     el.append(text, strings[i + 1])
//   //     if (stage?.reactive) {
//   //       stage.reactive.registerLoc(el, substitutions[i], (val) => {
//   //         text.textContent = val
//   //       })
//   //     } else text.textContent = substitutions[i]
//   //   }
//   // }
// }
