// { tag: t.moduleKeyword, color: 'red' },

export default {
  variant: "dark",
  settings: {
    background: "#303841",
    foreground: "#FFFFFF",
    caret: "#FBAC52",
    selection: "#4C5964",
    selectionMatch: "#3A546E",
    gutterBackground: "#303841",
    gutterForeground: "#FFFFFF70",
    lineHighlight: "#00000059",
  },
  styles: [
    { tag: ["meta", "comment"], color: "#A2A9B5" },
    { tag: ["attributeName", "keyword"], color: "#B78FBA" },
    { tag: "function.variableName", color: "#5AB0B0" },
    { tag: ["string", "regexp", "attributeValue"], color: "#99C592" },
    { tag: "operator", color: "#f47954" },

    { tag: ["tagName", "modifier"], color: "#E35F63" },
    {
      tag: [
        "number",
        "definition.tagName",
        "className",
        "definition.variableName",
      ],
      color: "#fbac52",
    },
    { tag: ["atom", "bool", "special.variableName"], color: "#E35F63" },
    { tag: "variableName", color: "#539ac4" },
    { tag: ["propertyName", "typeName"], color: "#629ccd" },
    { tag: "propertyName", color: "#36b7b5" },
  ],
}
