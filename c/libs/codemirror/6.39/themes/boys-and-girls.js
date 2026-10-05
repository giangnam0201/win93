// Author: unknown
export default {
  variant: "dark",
  settings: {
    background: "#000205",
    foreground: "#FFFFFF",
    caret: "#E60065",
    selection: "#E60C6559",
    gutterBackground: "#000205",
    gutterForeground: "#ffffff90",
    lineHighlight: "#4DD7FC1A",
  },
  styles: [
    { tag: "comment", color: "#404040" },
    { tag: ["string", "special.brace", "regexp"], color: "#00D8FF" },
    { tag: "number", color: "#E62286" },
    {
      tag: ["variableName", "attributeName", "self"],
      color: "#E62286",
      fontWeight: "bold",
    },
    { tag: "function.variableName", color: "#fff", fontWeight: "bold" },
  ],
}
