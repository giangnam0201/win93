/**
 * @name Xcode
 */

export default {
  variant: "dark",
  settings: {
    background: "#292A30",
    foreground: "#CECFD0",
    caret: "#fff",
    selection: "#727377",
    selectionMatch: "#727377",
    lineHighlight: "#ffffff0f",
  },
  styles: [
    { tag: ["comment", "quote"], color: "#7F8C98" },
    { tag: ["keyword"], color: "#FF7AB2", fontWeight: "bold" },
    { tag: ["string", "meta"], color: "#FF8170" },
    { tag: ["typeName"], color: "#DABAFF" },
    { tag: ["definition.variableName"], color: "#6BDFFF" },
    { tag: ["name"], color: "#6BAA9F" },
    { tag: ["variableName"], color: "#ACF2E4" },
    { tag: ["regexp", "link"], color: "#FF8170" },
  ],
}
