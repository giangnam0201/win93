/**
 * @name duotone
 * @author Bram de Haan
 * by Bram de Haan, adapted from DuoTone themes by Simurai (http://simurai.com/projects/2016/01/01/duotone-themes)
 */

export default {
  variant: "dark",
  settings: {
    background: "#2a2734",
    foreground: "#6c6783",
    caret: "#ffad5c",
    selection: "#91ff6c26",
    selectionMatch: "#91ff6c26",
    gutterBackground: "#2a2734",
    gutterForeground: "#545167",
    lineHighlight: "#36334280",
  },
  styles: [
    { tag: ["comment", "bracket"], color: "#6c6783" },
    {
      tag: ["atom", "number", "keyword", "link", "attributeName", "quote"],
      color: "#ffcc99",
    },
    {
      tag: [
        "emphasis",
        "heading",
        "tagName",
        "propertyName",
        "className",
        "variableName",
      ],
      color: "#eeebff",
    },
    { tag: ["typeName", "url"], color: "#7a63ee" },
    { tag: "operator", color: "#ffad5c" },
    { tag: "string", color: "#ffb870" },
    { tag: ["propertyName"], color: "#9a86fd" },
    { tag: ["unit", "punctuation"], color: "#e09142" },
  ],
}
