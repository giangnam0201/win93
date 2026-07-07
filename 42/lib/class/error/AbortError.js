export class AbortError extends Error {
  constructor(message) {
    super(message)
    Object.defineProperties(this, {
      name: { value: "AbortError" },
      code: { value: DOMException.ABORT_ERR },
    })
  }
}
