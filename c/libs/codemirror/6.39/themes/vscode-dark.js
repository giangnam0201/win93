/**
 * https://github.com/uiwjs/react-codemirror/issues/409
 */

export default {
  variant: "dark",
  settings: {
    background: "#1e1e1e",
    foreground: "#9cdcfe",
    caret: "#c6c6c6",
    selection: "#6199ff2f",
    selectionMatch: "#72a1ff59",
    lineHighlight: "#ffffff0f",
    gutterBackground: "#1e1e1e",
    gutterForeground: "#838383",
    gutterActiveForeground: "#fff",
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
      color: "#569cd6",
    },
    { tag: ["controlKeyword", "moduleKeyword"], color: "#c586c0" },
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
      color: "#9cdcfe",
    },
    { tag: "heading", fontWeight: "bold", color: "#9cdcfe" },
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
      color: "#4ec9b0",
    },
    {
      tag: ["function.variableName", "function.propertyName"],
      color: "#dcdcaa",
    },
    { tag: ["number"], color: "#b5cea8" },
    {
      tag: ["operator", "punctuation", "separator", "url", "escape", "regexp"],
      color: "#d4d4d4",
    },
    { tag: ["regexp"], color: "#d16969" },
    {
      tag: ["special.string", "processingInstruction", "string", "inserted"],
      color: "#ce9178",
    },
    { tag: ["angleBracket"], color: "#808080" },
    { tag: "strong", fontWeight: "bold" },
    { tag: "emphasis", fontStyle: "italic" },
    { tag: "strikethrough", textDecoration: "line-through" },
    { tag: ["meta", "comment"], color: "#6a9955" },
    { tag: "link", color: "#6a9955", textDecoration: "underline" },
    { tag: "invalid", color: "#ff0000" },
  ],
}
