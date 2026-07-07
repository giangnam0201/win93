// Author: unknown
export default {
  variant: "dark",
  settings: {
    background: "#060521",
    foreground: "#E0E0E0",
    caret: "#FFFFFFA6",
    selection: "#122BBB",
    gutterBackground: "#060521",
    gutterForeground: "#E0E0E090",
    lineHighlight: "#FFFFFF0F",
  },
  styles: [
    { tag: "comment", color: "#AEAEAE" },
    { tag: ["string", "special.brace", "regexp"], color: "#8DFF8E" },
    {
      tag: [
        "className",
        "definition.propertyName",
        "function.variableName",
        "function.definition.variableName",
        "definition.typeName",
      ],
      color: "#A3EBFF",
    },
    { tag: ["number", "bool", "null"], color: "#62E9BD" },
    { tag: ["keyword", "operator"], color: "#2BF1DC" },
    { tag: ["definitionKeyword", "modifier"], color: "#F8FBB1" },
    { tag: ["variableName", "self"], color: "#B683CA" },
    {
      tag: ["angleBracket", "tagName", "typeName", "propertyName"],
      color: "#60A4F1",
    },
    { tag: "derefOperator", color: "#E0E0E0" },
    { tag: "attributeName", color: "#7BACCA" },
  ],
}
