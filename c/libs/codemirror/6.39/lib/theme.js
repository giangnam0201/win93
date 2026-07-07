import { EditorView } from "./view.js"
import { HighlightStyle, syntaxHighlighting } from "./language.js"

/**
 * @typedef {import("./language/index.js").TagStyle} TagStyle
 * @typedef {import("./state/index.js").Extension} Extension
 */

/**
 * @typedef {object} Options
 * @property {Variant} variant Theme variant. Determines which styles CodeMirror will apply by default.
 * @property {Settings} settings Settings to customize the look of the editor, like background, gutter, selection and others.
 * @property {TagStyle[]} styles Syntax highlighting styles.
 */

/**
 * @typedef {object} Settings
 * @property {string} background Editor background.
 * @property {string} foreground Default text color.
 * @property {string} caret Caret color.
 * @property {string} selection Selection background.
 * @property {string} lineHighlight Background of highlighted lines.
 * @property {string} gutterBackground Gutter background.
 * @property {string} gutterForeground Text color inside gutter.
 */

/**
 * @typedef {'light' | 'dark'} Variant
 */

/**
 * @param {Options}
 * @returns {Extension}
 */
export const createTheme = ({ variant, settings, styles, css }) => {
  const themeOptions = {
    "&": {
      backgroundColor: settings.background,
      color: settings.foreground,
    },
    ".cm-highlightTab": {
      backgroundImage: `url(data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="20"><path stroke="${encodeURIComponent(settings.background)}" stroke-width="1" fill="none" d="M1 10H196L190 5M190 15L196 10M197 4L197 16"/></svg>)`,
    },
    ".cm-highlightSpace": {
      backgroundImage: `radial-gradient(circle at 50% 55%, currentColor 20%, transparent 5%)`,
      color: settings.background,
    },
    ".cm-trailingSpace": {
      backgroundColor: "transparent",
    },
    ".cm-trailingSpace > .cm-highlightSpace": {
      color: "#ff332255",
    },
    ".cm-content": {
      caretColor: settings.caret,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: settings.caret,
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: settings.selection,
      },
    "& .cm-selectionMatch": {
      backgroundColor: settings.selectionMatch,
    },
    ".cm-activeLine": {
      backgroundColor: settings.lineHighlight,
    },
    ".cm-gutters": {
      backgroundColor: settings.gutterBackground,
      color: settings.gutterForeground,
      borderRightColor: settings.gutterBorder,
    },
    ".cm-activeLineGutter": {
      backgroundColor: settings.lineHighlight,
    },
    ...css,
  }

  const theme = EditorView.theme(themeOptions, {
    dark: variant === "dark",
  })

  const highlightStyle = HighlightStyle.define(styles)
  const extension = [theme, syntaxHighlighting(highlightStyle)]

  return extension
}
