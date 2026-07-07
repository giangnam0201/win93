/**
 * https://github.com/uiwjs/react-codemirror/issues/409
 */

export default {
  variant: "light",
  settings: {
    background: "#ffffff",
    foreground: "#383a42",
    caret: "#000",
    selection: "#add6ff",
    selectionMatch: "#a8ac94",
    lineHighlight: "#99999926",
    gutterBackground: "#fff",
    gutterForeground: "#237893",
    gutterActiveForeground: "#0b216f",
    fontFamily:
      'Menlo, Monaco, Consolas, "Andale Mono", "Ubuntu Mono", "Courier New", monospace',
  },
  styles: [
    {
      tag: [
        "keyword",
        "operatorKeyword",
        "modifier",
        "color",
        "constant.name",
        "standard.name",
        "standard.tagName",
        "special.brace",
        "atom",
        "bool",
        "special.variableName",
      ],
      color: "#0000ff",
    },
    { tag: ["moduleKeyword", "controlKeyword"], color: "#af00db" },
    {
      tag: [
        "name",
        "deleted",
        "character",
        "macroName",
        "propertyName",
        "variableName",
        "labelName",
        "definition.name",
      ],
      color: "#0070c1",
    },
    { tag: "heading", fontWeight: "bold", color: "#0070c1" },
    {
      tag: [
        "typeName",
        "className",
        "tagName",
        "number",
        "changed",
        "annotation",
        "self",
        "namespace",
      ],
      color: "#267f99",
    },
    {
      tag: ["function.variableName", "function.propertyName"],
      color: "#795e26",
    },
    { tag: ["number"], color: "#098658" },
    {
      tag: ["operator", "punctuation", "separator", "url", "escape", "regexp"],
      color: "#383a42",
    },
    { tag: ["regexp"], color: "#af00db" },
    {
      tag: ["special.string", "processingInstruction", "string", "inserted"],
      color: "#a31515",
    },
    { tag: ["angleBracket"], color: "#383a42" },
    { tag: "strong", fontWeight: "bold" },
    { tag: "emphasis", fontStyle: "italic" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: ["meta", "comment"], color: "#008000" },
    { tag: "link", color: "#4078f2", textDecoration: "underline" },
    { tag: "invalid", color: "#e45649" },
  ],
}
