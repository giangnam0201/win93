// Author: Joe Bergantine
export default {
  variant: "dark",
  settings: {
    background: "#3b2627",
    foreground: "#E6E1C4",
    caret: "#E6E1C4",
    selection: "#16120E",
    gutterBackground: "#3b2627",
    gutterForeground: "#E6E1C490",
    lineHighlight: "#1F1611",
  },
  styles: [
    { tag: "comment", color: "#6B4E32" },
    { tag: ["keyword", "operator", "derefOperator"], color: "#EF5D32" },
    { tag: "className", color: "#EFAC32", fontWeight: "bold" },
    {
      tag: [
        "typeName",
        "propertyName",
        "function.variableName",
        "definition.variableName",
      ],
      color: "#EFAC32",
    },
    { tag: "definition.typeName", color: "#EFAC32", fontWeight: "bold" },
    { tag: "labelName", color: "#EFAC32", fontWeight: "bold" },
    { tag: ["number", "bool"], color: "#6C99BB" },
    { tag: ["variableName", "self"], color: "#7DAF9C" },
    { tag: ["string", "special.brace", "regexp"], color: "#D9D762" },
    { tag: ["angleBracket", "tagName", "attributeName"], color: "#EFCB43" },
  ],
}
