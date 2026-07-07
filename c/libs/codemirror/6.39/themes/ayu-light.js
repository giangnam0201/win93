// Author: Konstantin Pschera
export default {
  variant: "light",
  settings: {
    background: "#fcfcfc",
    foreground: "#5c6166",
    caret: "#ffaa33",
    selection: "#036dd626",
    gutterBackground: "#fcfcfc",
    gutterForeground: "#8a919966",
    lineHighlight: "#8a91991a",
  },
  styles: [
    { tag: "comment", color: "#787b8099" },
    { tag: "string", color: "#86b300" },
    { tag: "regexp", color: "#4cbf99" },
    { tag: ["number", "bool", "null"], color: "#ffaa33" },
    { tag: "variableName", color: "#5c6166" },
    { tag: ["definitionKeyword", "modifier"], color: "#fa8d3e" },
    { tag: ["keyword", "special.brace"], color: "#fa8d3e" },
    { tag: "operator", color: "#ed9366" },
    { tag: "separator", color: "#5c6166b3" },
    { tag: "punctuation", color: "#5c6166" },
    {
      tag: ["definition.propertyName", "function.variableName"],
      color: "#f2ae49",
    },
    { tag: ["className", "definition.typeName"], color: "#22a4e6" },
    { tag: ["tagName", "typeName", "self", "labelName"], color: "#55b4d4" },
    { tag: "angleBracket", color: "#55b4d480" },
    { tag: "attributeName", color: "#f2ae49" },
  ],
}
