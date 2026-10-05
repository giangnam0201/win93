/**
 * @name duotone
 * @author Bram de Haan
 * by Bram de Haan, adapted from DuoTone themes by Simurai (http://simurai.com/projects/2016/01/01/duotone-themes)
 */

export default {
  variant: "light",
  settings: {
    background: "#faf8f5",
    foreground: "#b29762",
    caret: "#93abdc",
    selection: "#e3dcce",
    selectionMatch: "#e3dcce",
    gutterBackground: "#faf8f5",
    gutterForeground: "#cdc4b1",
    gutterBorder: "transparent",
    lineHighlight: "#ddceb154",
  },
  styles: [
    { tag: ["comment", "bracket"], color: "#b6ad9a" },
    {
      tag: ["atom", "number", "keyword", "link", "attributeName", "quote"],
      color: "#063289",
    },
    {
      tag: ["emphasis", "heading", "tagName", "propertyName", "variableName"],
      color: "#2d2006",
    },
    { tag: ["typeName", "url", "string"], color: "#896724" },
    { tag: ["operator", "string"], color: "#1659df" },
    { tag: ["propertyName"], color: "#b29762" },
    { tag: ["unit", "punctuation"], color: "#063289" },
  ],
}
