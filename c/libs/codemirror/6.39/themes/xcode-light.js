/**
 * @name Xcode
 */

export default {
  variant: "light",
  settings: {
    background: "#fff",
    foreground: "#3D3D3D",
    selection: "#BBDFFF",
    selectionMatch: "#BBDFFF",
    gutterBackground: "#fff",
    gutterForeground: "#AFAFAF",
    lineHighlight: "#d5e6ff69",
  },
  styles: [
    { tag: ["comment", "quote"], color: "#707F8D" },
    { tag: ["typeName", "typeOperator"], color: "#aa0d91" },
    { tag: ["keyword"], color: "#aa0d91", fontWeight: "bold" },
    { tag: ["string", "meta"], color: "#D23423" },
    { tag: ["name"], color: "#032f62" },
    { tag: ["typeName"], color: "#522BB2" },
    { tag: ["variableName"], color: "#23575C" },
    { tag: ["definition.variableName"], color: "#327A9E" },
    { tag: ["regexp", "link"], color: "#0e0eff" },
  ],
}
