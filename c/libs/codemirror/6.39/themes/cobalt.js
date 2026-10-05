// Author: Jacob Rus
export default {
  variant: "dark",
  settings: {
    background: "#00254b",
    foreground: "#FFFFFF",
    caret: "#FFFFFF",
    selection: "#B36539BF",
    gutterBackground: "#00254b",
    gutterForeground: "#FFFFFF70",
    lineHighlight: "#00000059",
  },
  styles: [
    { tag: "comment", color: "#0088FF" },
    { tag: "string", color: "#3AD900" },
    { tag: "regexp", color: "#80FFC2" },
    { tag: ["number", "bool", "null"], color: "#FF628C" },
    { tag: ["definitionKeyword", "modifier"], color: "#FFEE80" },
    { tag: "variableName", color: "#CCCCCC" },
    { tag: "self", color: "#FF80E1" },
    {
      tag: [
        "className",
        "definition.propertyName",
        "function.variableName",
        "definition.typeName",
        "labelName",
      ],
      color: "#FFDD00",
    },
    { tag: ["keyword", "operator"], color: "#FF9D00" },
    { tag: ["propertyName", "typeName"], color: "#80FFBB" },
    { tag: "special.brace", color: "#EDEF7D" },
    { tag: "attributeName", color: "#9EFFFF" },
    { tag: "derefOperator", color: "#fff" },
  ],
}
