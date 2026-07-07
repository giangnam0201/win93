import { persist } from "./persist.js"
import { observe } from "../lib/type/object/observe.js"
import { dispatch } from "../lib/event/dispatch.js"
import { debounce } from "../lib/timing/debounce.js"

const EMPTY = Symbol("EMPTY")

export async function keep(path, options, state) {
  if (state === undefined) {
    state = options ?? {}
    options = {}
  }

  const { signal } = options
  let data = EMPTY

  if (persist.has(path)) {
    try {
      data = await persist.get(path)
    } catch (err) {
      dispatch(globalThis, err) // never let a corrupt file fail a settings
    }
  }

  if (data === EMPTY) {
    persist.set(path, state).catch((err) => dispatch(globalThis, err))
    data = state
  }

  return observe(
    data,
    { signal },
    debounce(() => persist.set(path, data)),
  )
}

keep.delete = async (path) => persist.delete(path)
