/**
 * @name github
 */

export default {
  variant: "light",
  settings: {
    background: "#fff",
    foreground: "#24292e",
    selection: "#BBDFFF",
    selectionMatch: "#BBDFFF",
    gutterBackground: "#fff",
    gutterForeground: "#6e7781",
  },
  styles: [
    { tag: ["standard.tagName", "tagName"], color: "#116329" },
    { tag: ["comment", "bracket"], color: "#6a737d" },
    { tag: ["className", "propertyName"], color: "#6f42c1" },
    {
      tag: ["variableName", "attributeName", "number", "operator"],
      color: "#005cc5",
    },
    {
      tag: ["keyword", "typeName", "typeOperator", "typeName"],
      color: "#d73a49",
    },
    { tag: ["string", "meta", "regexp"], color: "#032f62" },
    { tag: ["name", "quote"], color: "#22863a" },
    { tag: ["heading", "strong"], color: "#24292e", fontWeight: "bold" },
    { tag: ["emphasis"], color: "#24292e", fontStyle: "italic" },
    { tag: ["deleted"], color: "#b31d28", backgroundColor: "ffeef0" },
    { tag: ["atom", "bool", "special.variableName"], color: "#e36209" },
    { tag: ["url", "escape", "regexp", "link"], color: "#032f62" },
    { tag: "link", textDecoration: "underline" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: "invalid", color: "#cb2431" },
  ],
}
