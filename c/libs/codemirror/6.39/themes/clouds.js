// Author: Fred LeBlanc
export default {
  variant: "light",
  settings: {
    background: "#fff",
    foreground: "#000",
    caret: "#000",
    selection: "#BDD5FC",
    gutterBackground: "#fff",
    gutterForeground: "#00000070",
    lineHighlight: "#FFFBD1",
  },
  styles: [
    { tag: "comment", color: "#BCC8BA" },
    { tag: ["string", "special.brace", "regexp"], color: "#5D90CD" },
    { tag: ["number", "bool", "null"], color: "#46A609" },
    { tag: "keyword", color: "#AF956F" },
    { tag: ["definitionKeyword", "modifier"], color: "#C52727" },
    { tag: ["angleBracket", "tagName", "attributeName"], color: "#606060" },
    { tag: "self", color: "#000" },
  ],
}
