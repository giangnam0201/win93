import elements, { frag } from "./front/elements.js";

export { text, frag, parse, empty } from "./front/elements.js";

export function el(tag, ...rest) {
  const el = document.createElement(tag);
  return elements(el, ...rest);
}

export const a = (...args) => el("a", ...args);
export const article = (...args) => el("article", ...args);
export const aside = (...args) => el("aside", ...args);
// export const audio = (...args) => el("audio", ...args);
export const br = (...args) => el("br", ...args);
export const button = (...args) => el("button", ...args);
export const canvas = (...args) => el("canvas", ...args);
export const code = (...args) => el("code", ...args);
export const div = (...args) => el("div", ...args);
export const em = (...args) => el("em", ...args);
export const footer = (...args) => el("footer", ...args);
export const form = (...args) => el("form", ...args);
export const h1 = (...args) => el("h1", ...args);
export const h2 = (...args) => el("h2", ...args);
export const h3 = (...args) => el("h3", ...args);
export const h4 = (...args) => el("h4", ...args);
export const h5 = (...args) => el("h5", ...args);
export const h6 = (...args) => el("h6", ...args);
export const header = (...args) => el("header", ...args);
export const hr = (...args) => el("hr", ...args);
// export const iframe = (...args) => el("iframe", ...args);
// export const img = (...args) => el("img", ...args);
export const input = (...args) => el("input", ...args);
export const label = (...args) => el("label", ...args);
export const datalist = (...args) => el("datalist", ...args);
export const li = (...args) => el("li", ...args);
// export const link = (...args) => el("link", ...args);
export const main = (...args) => el("main", ...args);
export const meta = (...args) => el("meta", ...args);
export const nav = (...args) => el("nav", ...args);
export const ol = (...args) => el("ol", ...args);
export const option = (...args) => el("option", ...args);
export const p = (...args) => el("p", ...args);
export const pre = (...args) => el("pre", ...args);
export const progress = (...args) => el("progress", ...args);
// export const script = (...args) => el("script", ...args);
export const section = (...args) => el("section", ...args);
export const select = (...args) => el("select", ...args);
export const span = (...args) => el("span", ...args);
export const slot = (...args) => el("slot", ...args);
export const strong = (...args) => el("strong", ...args);
export const style = (...args) => el("style", ...args);
export const sub = (...args) => el("sub", ...args);
export const sup = (...args) => el("sup", ...args);
export const table = (...args) => el("table", ...args);
export const tbody = (...args) => el("tbody", ...args);
export const thead = (...args) => el("thead", ...args);
export const td = (...args) => el("td", ...args);
export const textarea = (...args) => el("textarea", ...args);
export const th = (...args) => el("th", ...args);
export const tr = (...args) => el("tr", ...args);
export const ul = (...args) => el("ul", ...args);
// export const video = (...args) => el("video", ...args);

// loadable elements
////////////////////

function loadable(name, ...args) {
  if (typeof args[0] === "string") args = [args];
  if (Array.isArray(args[0])) {
    if (name === "link") return frag(args[0].map(href => el(name, { href })));
    else if (name === "script")
      return frag(args[0].map(src => el(name, { src, async: false })));
    return frag(args[0].map(src => el(name, { src })));
  }
  return el(name, ...args);
}

export const audio = (...args) => loadable("audio", ...args);
export const iframe = (...args) => loadable("iframe", ...args);
export const img = (...args) => loadable("img", ...args);
export const link = (...args) => loadable("link", ...args);
export const script = (...args) => loadable("script", ...args);
export const video = (...args) => loadable("video", ...args);

const cleanNode = node => (
  (node.onload = node.onreadystatechange = node.onerror = null), node
);

export const loadNode = node =>
  new Promise((resolve, reject) => {
    if (node.nodeName === "LINK") {
      resolve(node);
    } else {
      node.onload = node.onreadystatechange = () => resolve(cleanNode(node));
      node.onerror = err => {
        cleanNode(node);
        reject(err);
      };
    }
  });

export const load = (...args) =>
  Promise.all(
    args.map(async item => {
      let nodes;
      if (item.nodeType === 11) nodes = [...item.childNodes];
      document.body.appendChild(item);
      if (nodes) {
        for (const node of nodes) await loadNode(node);
        return nodes;
      }
      return await loadNode(item);
    })
  );

// sugar
////////

/*  */
const { toString } = Object.prototype;

const isPlainObject = x => {
  let prototype;
  return (
    toString.call(x) === "[object Object]" &&
    ((prototype = Object.getPrototypeOf(x)),
    prototype === null || prototype === Object.getPrototypeOf({}))
  );
};
/*  */

export const checkbox = (val, cb) =>
  input({
    onchange: e => typeof cb === "function" && cb(e.target.checked),
    type: "checkbox",
    checked: Boolean(val),
  });

export const spread = (data, stringify = JSON.stringify) =>
  table([
    thead(data[0] && tr(Object.keys(data[0]).map(key => th(key)))),
    tbody(
      data.map(item =>
        tr(
          Object.values(item).map(val =>
            td(isPlainObject(val) ? spread([val]) : stringify(val))
          )
        )
      )
    ),
  ]);
