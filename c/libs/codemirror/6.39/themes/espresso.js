// Author: TextMate
export default {
  variant: "light",
  settings: {
    background: "#FFFFFF",
    foreground: "#000000",
    caret: "#000000",
    selection: "#80C7FF",
    gutterBackground: "#FFFFFF",
    gutterForeground: "#00000070",
    lineHighlight: "#C1E2F8",
  },
  styles: [
    { tag: "comment", color: "#AAAAAA" },
    {
      tag: ["keyword", "operator", "typeName", "tagName", "propertyName"],
      color: "#2F6F9F",
      fontWeight: "bold",
    },
    { tag: ["attributeName", "definition.propertyName"], color: "#4F9FD0" },
    { tag: ["className", "string", "special.brace"], color: "#CF4F5F" },
    { tag: "number", color: "#CF4F5F", fontWeight: "bold" },
    { tag: "variableName", fontWeight: "bold" },
  ],
}
