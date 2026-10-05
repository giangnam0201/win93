// thanks:
// - https://hackernoon.com/how-i-converted-my-react-app-to-vanillajs-and-whether-or-not-it-was-a-terrible-idea-4b14b1b2faff#.kn8865cln
// - https://github.com/davidgilbertson/know-it-all/blob/master/app/utils/elements.js
// to read: https://github.com/svileng/docrel
// to read: https://github.com/pakastin/frzr
// to read: https://github.com/hyperhype/hyperscript
// to read: https://github.com/substack/hyperx
// to read: https://github.com/pakastin/redom/blob/master/src/create-element.js
// to read: https://github.com/vadimdemedes/dom-chef/blob/master/index.js

const attributeExceptions = ["for", "role", "dataset", "data", "class"];

export const empty = el => {
  while (el.firstChild) el.removeChild(el.firstChild);
};

export const frag = (...rest) =>
  appendArray(document.createDocumentFragment(), rest);

export const text = str => document.createTextNode(str);

const parser = new DOMParser();
export const parse = str => parser.parseFromString(str, "text/html");
// export const parse = str =>
//   [...parser.parseFromString(str, "text/html").body.childNodes].reduce(
//     (acc, item) => (acc.appendChild(item), acc),
//     document.createDocumentFragment()
//   );

export function setStyles(el, styles) {
  if (!styles) {
    el.removeAttribute("styles");
    return;
  }

  Object.keys(styles).forEach(styleName => {
    if (styleName in el.style) {
      el.style[styleName] = styles[styleName];
    } else {
      console.warn(
        `${styleName} is not a valid style for <${el.tagName.toLowerCase()}>`
      );
    }
  });
}

export function setDataAttributes(el, dataAttributes) {
  Object.entries(dataAttributes).forEach(([key, val]) => {
    el.setAttribute(`data-${key}`, val);
  });
}

export function appendArray(el, children) {
  children.forEach(item => {
    if (item) {
      const type = typeof item;
      if (type === "string" || type === "number") {
        el.appendChild(text(item));
      } else if (Array.isArray(item)) {
        appendArray(el, item);
      } else if (typeof item.nodeType === "number") {
        el.appendChild(item);
      } else if (item.el) {
        el.appendChild(item.el);
      } else if (item.render) {
        el.appendChild(frag(item.render()));
      }
    }
  });
  return el;
}

export default function setElement(el, ...rest) {
  const fragment = document.createDocumentFragment();
  rest.forEach(item => {
    if (item) {
      let type = typeof item;

      if (type === "function") {
        item = { onclick: item };
        type = "object";
      }

      if (typeof item.nodeType === "number") {
        fragment.appendChild(item);
      } else if (type === "string" || type === "number") {
        fragment.appendChild(text(item));
      } else if (Array.isArray(item)) {
        appendArray(fragment, item);
      } else if (item.el) {
        fragment.appendChild(item.el);
      } else if (item.render) {
        fragment.appendChild(frag(item.render()));
      } else if (type === "object") {
        Object.entries(item).forEach(([key, val]) => {
          if (key in el || attributeExceptions.includes(key)) {
            const type = typeof val;
            if (key === "class" || key === "className") {
              if (type === "string") {
                el.setAttribute("class", val); // needed for svg
              } else if (Array.isArray(val)) {
                el.setAttribute("class", val.filter(Boolean).join(" "));
              } else {
                Object.entries(val).forEach(([key, val]) => {
                  el.classList[val ? "add" : "remove"](key);
                });
              }
            } else if (key === "css") {
              el.style.cssText = val;
            } else if (key === "style") {
              setStyles(el, val);
            } else if (key === "dataset" || key === "data") {
              setDataAttributes(el, val);
            } else if (key === "async" || key === "checked") {
              el[key] = val;
            } else if (val !== 0 && Boolean(val) === false) {
              el.removeAttribute(key);
            } else if (key === "value" || type === "function") {
              el[key] = val;
            } else {
              el.setAttribute(key, val);
            }
          } else {
            console.warn(`${key} is not a valid property of a <${type}>`);
          }
        });
      }
    }
  });

  el.appendChild(fragment);
  return el;
}
