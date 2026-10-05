/**
 * @name androidstudio
 */

export default {
  variant: "dark",
  settings: {
    background: "#282b2e",
    foreground: "#a9b7c6",
    caret: "#00FF00",
    selection: "#4e5254",
    selectionMatch: "#4e5254",
    lineHighlight: "#7f85891f",
  },
  styles: [
    { tag: ["keyword", "deleted", "className"], color: "#cc7832" },
    { tag: ["number", "literal", "derefOperator"], color: "#6897bb" },
    { tag: ["link", "variableName"], color: "#629755" },
    { tag: ["comment", "quote"], color: "grey" },
    { tag: ["meta", "documentMeta"], color: "#bbb529" },
    { tag: ["string", "propertyName", "attributeValue"], color: "#6a8759" },
    { tag: ["heading", "typeName"], color: "#ffc66d" },
    { tag: ["attributeName"], color: "#a9b7c6" },
    { tag: ["emphasis"], fontStyle: "italic" },
  ],
}
