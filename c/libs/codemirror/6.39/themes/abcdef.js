/**
 * @name abcdef
 * @author codemirror.net
 * https://codemirror.net/5/theme/abcdef.css
 */
// { tag: t.qualifier, color: '#FFF700' },
// { tag: t.builtin, color: '#30aabc' },

export default {
  variant: "dark",
  settings: {
    background: "#0f0f0f",
    foreground: "#defdef",
    caret: "#00FF00",
    selection: "#515151",
    selectionMatch: "#515151",
    gutterBackground: "#555",
    gutterForeground: "#FFFFFF",
    lineHighlight: "#0a6bcb3d",
  },
  styles: [
    { tag: "keyword", color: "darkgoldenrod", fontWeight: "bold" },
    { tag: "atom", color: "#77F" },
    { tag: "comment", color: "#7a7b7c", fontStyle: "italic" },
    { tag: "number", color: "violet" },
    { tag: "definition.variableName", color: "#fffabc" },
    { tag: "variableName", color: "#abcdef" },
    { tag: "function.variableName", color: "#fffabc" },
    { tag: "typeName", color: "#FFDD44" },
    { tag: "tagName", color: "#def" },
    { tag: "string", color: "#2b4" },
    { tag: "meta", color: "#C9F" },

    { tag: "bracket", color: "#8a8a8a" },
    { tag: "attributeName", color: "#DDFF00" },
    { tag: "heading", color: "aquamarine", fontWeight: "bold" },
    { tag: "link", color: "blueviolet", fontWeight: "bold" },
  ],
}
