// { tag: t.keyword, color: '#f92672' },

export default {
  variant: "dark",
  settings: {
    background: "#272822",
    foreground: "#FFFFFF",
    caret: "#FFFFFF",
    selection: "#49483E",
    selectionMatch: "#49483E",
    gutterBackground: "#272822",
    gutterForeground: "#FFFFFF70",
    lineHighlight: "#0000003b",
  },
  styles: [
    { tag: ["comment", "documentMeta"], color: "#8292a2" },
    { tag: ["number", "bool", "null", "atom"], color: "#ae81ff" },
    { tag: ["attributeValue", "className", "name"], color: "#e6db74" },
    { tag: ["propertyName", "attributeName"], color: "#a6e22e" },
    { tag: ["variableName"], color: "#9effff" },
    { tag: ["squareBracket"], color: "#bababa" },
    { tag: ["string", "special.brace"], color: "#e6db74" },
    {
      tag: ["regexp", "className", "typeName", "definition.typeName"],
      color: "#66d9ef",
    },
    {
      tag: [
        "definition.variableName",
        "definition.propertyName",
        "function.variableName",
      ],
      color: "#fd971f",
    },

    {
      tag: [
        "keyword",
        "definitionKeyword",
        "modifier",
        "tagName",
        "angleBracket",
      ],
      color: "#f92672",
    },
  ],
}
