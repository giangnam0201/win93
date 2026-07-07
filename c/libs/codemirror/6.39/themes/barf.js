// Author: unknown
export default {
  variant: "dark",
  settings: {
    background: "#15191EFA",
    foreground: "#EEF2F7",
    caret: "#C4C4C4",
    selection: "#90B2D557",
    gutterBackground: "#15191EFA",
    gutterForeground: "#aaaaaa95",
    lineHighlight: "#57575712",
  },
  styles: [
    { tag: "comment", color: "#6E6E6E" },
    { tag: ["string", "regexp", "special.brace"], color: "#5C81B3" },
    { tag: "number", color: "#C1E1B8" },
    { tag: "bool", color: "#53667D" },
    {
      tag: ["definitionKeyword", "modifier", "function.propertyName"],
      color: "#A3D295",
      fontWeight: "bold",
    },
    {
      tag: ["keyword", "moduleKeyword", "operatorKeyword", "operator"],
      color: "#697A8E",
      fontWeight: "bold",
    },
    { tag: ["variableName", "attributeName"], color: "#708E67" },
    {
      tag: [
        "function.variableName",
        "definition.propertyName",
        "derefOperator",
      ],
      color: "#fff",
    },
    { tag: "tagName", color: "#A3D295" },
  ],
}
