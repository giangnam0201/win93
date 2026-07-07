// Author: Chris Kempson
export default {
  variant: "light",
  settings: {
    background: "#FFFFFF",
    foreground: "#4D4D4C",
    caret: "#AEAFAD",
    selection: "#D6D6D6",
    gutterBackground: "#FFFFFF",
    gutterForeground: "#4D4D4C80",
    lineHighlight: "#EFEFEF",
  },
  styles: [
    { tag: "comment", color: "#8E908C" },
    {
      tag: ["variableName", "self", "propertyName", "attributeName", "regexp"],
      color: "#C82829",
    },
    { tag: ["number", "bool", "null"], color: "#F5871F" },
    {
      tag: ["className", "typeName", "definition.typeName"],
      color: "#C99E00",
    },
    { tag: ["string", "special.brace"], color: "#718C00" },
    { tag: "operator", color: "#3E999F" },
    {
      tag: ["definition.propertyName", "function.variableName"],
      color: "#4271AE",
    },
    { tag: "keyword", color: "#8959A8" },
    { tag: "derefOperator", color: "#4D4D4C" },
  ],
}
