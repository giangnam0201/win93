/**
 * @name Bespin
 * @author Mozilla / Jan T. Sott
 *
 * CodeMirror template by Jan T. Sott (https://github.com/idleberg/base16-codemirror)
 * Original Base16 color scheme by Chris Kempson (https://github.com/chriskempson/base16)
 */

export default {
  variant: "dark",
  settings: {
    background: "#28211c",
    foreground: "#9d9b97",
    caret: "#797977",
    selection: "#4f382b",
    selectionMatch: "#4f382b",
    gutterBackground: "#28211c",
    gutterForeground: "#666666",
    lineHighlight: "#ffffff1a",
  },
  styles: [
    { tag: ["atom", "number", "link", "bool"], color: "#9b859d" },
    { tag: "comment", color: "#937121" },
    { tag: ["keyword", "tagName"], color: "#cf6a4c" },
    { tag: "string", color: "#f9ee98" },
    { tag: "bracket", color: "#9d9b97" },
    { tag: ["variableName"], color: "#5ea6ea" },
    { tag: "definition.variableName", color: "#cf7d34" },
    { tag: ["function.variableName", "className"], color: "#cf7d34" },
    { tag: ["propertyName", "attributeName"], color: "#54be0d" },
  ],
}
