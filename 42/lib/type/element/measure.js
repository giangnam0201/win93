const { round } = Math

const sizeWatch = new Map()
const positionWatch = new Map()
const sizeCache = new WeakMap()
const positionCache = new WeakMap()
let sizeObserver
let positionObserver

function ensureSizeObserver() {
  if (sizeObserver) return sizeObserver
  sizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) sizeCache.set(entry.target, entry)
    // Defer to next frame to prevent "ResizeObserver loop completed with undelivered notifications"
    requestAnimationFrame(() => {
      for (const entry of entries) {
        const set = sizeWatch.get(entry.target)
        if (!set) continue
        for (const cb of set) cb(entry)
      }
    })
  })
  return sizeObserver
}

function ensurePositionObserver() {
  if (positionObserver) return positionObserver
  positionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      positionCache.set(entry.target, entry.boundingClientRect)
      const set = positionWatch.get(entry.target)
      if (!set) continue
      for (const cb of set) cb(entry)
    }
  })
  return positionObserver
}

/**
 * @typedef {"size" | "position" | "both"} MeasureMode
 *
 * @typedef {{
 *   mode?: MeasureMode
 *   subpixel?: boolean
 *   contentBox?: boolean
 *   signal?: AbortSignal
 * }} MeasureOptions
 *
 * @typedef {{
 *   target: Element
 *   width?: number
 *   height?: number
 *   x?: number
 *   y?: number
 * }} MeasureRect
 */

/**
 * Asynchronously measure elements without forcing synchronous layout.
 *
 * @overload
 * @param {Element} elements
 * @param {MeasureOptions} [options]
 * @returns {Promise<MeasureRect>}
 */
/**
 * @overload
 * @param {Element[] | NodeListOf<Element> | HTMLCollectionOf<Element>} elements
 * @param {MeasureOptions} [options]
 * @returns {Promise<MeasureRect[]>}
 */
/**
 * @param {Element | Element[] | NodeListOf<Element> | HTMLCollectionOf<Element>} elements
 * @param {MeasureOptions} [options]
 * @returns {Promise<MeasureRect | MeasureRect[]>}
 */
export async function measure(elements, options) {
  const mode = options?.mode ?? "both"
  const measureSize = mode !== "position"
  const measurePosition = mode !== "size"
  const subpixel = options?.subpixel === true

  const isSingle = elements instanceof Element
  const list = isSingle ? [elements] : Array.from(elements ?? [])

  if (list.length === 0) return isSingle ? { target: list[0] } : []

  const targets = new Set(list)

  const abortResult = () =>
    isSingle ? { target: list[0] } : list.map((target) => ({ target }))

  const sizePromise = measureSize
    ? new Promise((resolve) => {
        if (options?.signal?.aborted) return resolve(new Map())
        const sizeKey = options?.contentBox ? "contentBoxSize" : "borderBoxSize"
        /** @type {Map<Element, { width: number, height: number }>} */
        const sizes = new Map()
        const observer = ensureSizeObserver()
        const cb = (entry) => {
          if (!targets.has(entry.target)) return
          const size = entry[sizeKey][0]
          sizes.set(entry.target, {
            width: size.inlineSize,
            height: size.blockSize,
          })
          if (sizes.size !== targets.size) return
          cleanup()
          resolve(sizes)
        }

        const cleanup = () => {
          for (const el of list) {
            const set = sizeWatch.get(el)
            if (!set) continue
            set.delete(cb)
            if (set.size === 0) {
              sizeWatch.delete(el)
              observer.unobserve(el)
            }
          }
          if (sizeWatch.size === 0) {
            observer.disconnect()
            sizeObserver = undefined
          }
        }

        options?.signal?.addEventListener("abort", () => {
          cleanup()
          resolve(new Map())
        })

        for (const el of list) {
          const set = sizeWatch.get(el)
          if (set) {
            const entry = sizeCache.get(el)
            if (entry) {
              const size = entry[sizeKey][0]
              sizes.set(el, {
                width: size.inlineSize,
                height: size.blockSize,
              })
            }

            set.add(cb)
          } else {
            sizeWatch.set(el, new Set([cb]))
            observer.observe(el)
          }
        }

        if (sizes.size === targets.size) {
          cleanup()
          resolve(sizes)
        }
      })
    : Promise.resolve(new Map())

  const positionPromise = measurePosition
    ? new Promise((resolve) => {
        if (options?.signal?.aborted) return resolve(new Map())
        /** @type {Map<Element, DOMRectReadOnly>} */
        const positions = new Map()
        const observer = ensurePositionObserver()
        const cb = (entry) => {
          if (!targets.has(entry.target)) return
          positions.set(entry.target, entry.boundingClientRect)
          if (positions.size !== targets.size) return
          cleanup()
          resolve(positions)
        }

        const cleanup = () => {
          for (const el of list) {
            const set = positionWatch.get(el)
            if (!set) continue
            set.delete(cb)
            if (set.size === 0) {
              positionWatch.delete(el)
              observer.unobserve(el)
            }
          }
          if (positionWatch.size === 0) {
            observer.disconnect()
            positionObserver = undefined
          }
        }

        options?.signal?.addEventListener("abort", () => {
          cleanup()
          resolve(new Map())
        })

        for (const el of list) {
          const set = positionWatch.get(el)
          if (set) {
            const rect = positionCache.get(el)
            if (rect) positions.set(el, rect)
            set.add(cb)
          } else {
            positionWatch.set(el, new Set([cb]))
            observer.observe(el)
          }
        }

        if (positions.size === targets.size) {
          cleanup()
          resolve(positions)
        }
      })
    : Promise.resolve(new Map())

  const [sizes, positions] = await Promise.all([sizePromise, positionPromise])

  if (options?.signal?.aborted) return abortResult()

  const rects = list.map((el) => {
    /** @type {MeasureRect} */
    const rect = { target: el }
    let left
    let top

    if (measurePosition) {
      const pos = positions.get(el)
      left = pos.left
      top = pos.top
      rect.width = pos.width
      rect.height = pos.height
    }

    if (measureSize) {
      const size = sizes.get(el)
      rect.width = size.width
      rect.height = size.height
    }

    if (!subpixel) {
      if (rect.width != null) rect.width = round(rect.width)
      if (rect.height != null) rect.height = round(rect.height)
      if (left != null) left = round(left)
      if (top != null) top = round(top)

      if (left != null && top != null) {
        rect.x = left
        rect.y = top
      }
    } else if (left != null && top != null) {
      rect.x = left
      rect.y = top
    }

    return rect
  })

  return isSingle ? rects[0] : rects
}

