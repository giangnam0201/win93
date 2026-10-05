// Author: Kenneth Reitz
export default {
  variant: "light",
  settings: {
    background: "#FFFFFF",
    foreground: "#000000",
    caret: "#000000",
    selection: "#FFFD0054",
    gutterBackground: "#FFFFFF",
    gutterForeground: "#00000070",
    lineHighlight: "#00000008",
  },
  styles: [
    { tag: "comment", color: "#CFCFCF" },
    { tag: ["number", "bool", "null"], color: "#E66C29" },
    {
      tag: [
        "className",
        "definition.propertyName",
        "function.variableName",
        "labelName",
        "definition.typeName",
      ],
      color: "#2EB43B",
    },
    { tag: "keyword", color: "#D8B229" },
    { tag: "operator", color: "#4EA44E", fontWeight: "bold" },
    { tag: ["definitionKeyword", "modifier"], color: "#925A47" },
    { tag: "string", color: "#704D3D" },
    { tag: "typeName", color: "#2F8996" },
    { tag: ["variableName", "propertyName"], color: "#77ACB0" },
    { tag: "self", color: "#77ACB0", fontWeight: "bold" },
    { tag: "regexp", color: "#E3965E" },
    { tag: ["tagName", "angleBracket"], color: "#BAA827" },
    { tag: "attributeName", color: "#B06520" },
    { tag: "derefOperator", color: "#000" },
  ],
}
