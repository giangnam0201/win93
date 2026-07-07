const MINIMUM_COLS = 2
const MINIMUM_ROWS = 1
const DEFAULT_SCROLL_BAR_WIDTH = 14

export function fit(term) {
  const dims = proposeDimensions(term)
  if (!dims || !term || Number.isNaN(dims.cols) || Number.isNaN(dims.rows)) {
    return
  }

  const core = term._core

  // Force a full render
  if (term.rows !== dims.rows || term.cols !== dims.cols) {
    core._renderService.clear()
    term.resize(dims.cols, dims.rows)
  }
}

export function proposeDimensions(term) {
  if (!term) return
  if (!term.element || !term.element.parentElement) return

  const core = term._core
  const dims = core._renderService.dimensions

  if (dims.css.cell.width === 0 || dims.css.cell.height === 0) return

  const scrollbarWidth =
    term.options.scrollback === 0
      ? 0
      : term.options.overviewRuler?.width || DEFAULT_SCROLL_BAR_WIDTH

  const parentRect = term.element.parentElement.getBoundingClientRect()

  const elementStyle = window.getComputedStyle(term.element)
  const elementPadding = {
    top: Number.parseInt(elementStyle.paddingTop, 10),
    bottom: Number.parseInt(elementStyle.paddingBottom, 10),
    right: Number.parseInt(elementStyle.paddingRight, 10),
    left: Number.parseInt(elementStyle.paddingLeft, 10),
  }
  const elementPaddingVer = elementPadding.top + elementPadding.bottom
  const elementPaddingHor = elementPadding.right + elementPadding.left
  const availableHeight = parentRect.height - elementPaddingVer
  const availableWidth = parentRect.width - elementPaddingHor - scrollbarWidth

  return {
    cols: Math.max(
      MINIMUM_COLS,
      Math.floor(availableWidth / dims.css.cell.width),
    ),
    rows: Math.max(
      MINIMUM_ROWS,
      Math.floor(availableHeight / dims.css.cell.height),
    ),
  }
}
