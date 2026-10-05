/**
 * @name dracula
 * @author dracula
 * Michael Kaminsky (http://github.com/mkaminsky11)
 * Original dracula color scheme by Zeno Rocha (https://github.com/zenorocha/dracula-theme)
 */

export default {
  variant: "dark",
  settings: {
    background: "#282a36",
    foreground: "#f8f8f2",
    caret: "#f8f8f0",
    selection: "rgba(255, 255, 255, 0.1)",
    selectionMatch: "rgba(255, 255, 255, 0.2)",
    gutterBackground: "#282a36",
    gutterForeground: "#6D8A88",
    gutterBorder: "transparent",
    lineHighlight: "rgba(255, 255, 255, 0.1)",
  },
  styles: [
    { tag: "comment", color: "#6272a4" },
    { tag: ["string", "special.brace", "quote"], color: "#f1fa8c" },
    { tag: ["number", "self", "bool", "null"], color: "#bd93f9" },
    { tag: "atom", color: "#bd93f9" },
    { tag: "meta", color: "#f8f8f2" },
    { tag: ["keyword", "operator", "tagName", "heading"], color: "#ff79c6" },
    { tag: ["function.propertyName", "propertyName"], color: "#66d9ef" },
    {
      tag: [
        "definition.propertyName",
        "definition.variableName",
        "function.variableName",
        "className",
        "attributeName",
      ],
      color: "#50fa7b",
    },
    { tag: "atom", color: "#bd93f9" },
  ],
}
