// Author: Rosé Pine
export default {
  variant: "light",
  settings: {
    background: "#faf4ed",
    foreground: "#575279",
    caret: "#575279",
    selection: "#6e6a8614",
    gutterBackground: "#faf4ed",
    gutterForeground: "#57527970",
    lineHighlight: "#6e6a860d",
  },
  styles: [
    { tag: "comment", color: "#9893a5" },
    { tag: ["bool", "null"], color: "#286983" },
    { tag: "number", color: "#d7827e" },
    { tag: "className", color: "#d7827e" },
    { tag: ["angleBracket", "tagName", "typeName"], color: "#56949f" },
    { tag: "attributeName", color: "#907aa9" },
    { tag: "punctuation", color: "#797593" },
    { tag: ["keyword", "modifier"], color: "#286983" },
    { tag: ["string", "regexp"], color: "#ea9d34" },
    { tag: "variableName", color: "#d7827e" },
  ],
}
