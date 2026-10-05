/** Error thrown when an assertion fails. */
export class AssertionError extends Error {
  constructor(message, cause, stack) {
    super(message ?? "Unspecified assertion error")
    Object.defineProperty(this, "name", { value: "AssertionError" })
    if (cause) this.cause = cause
    if (stack) this.stack = stack
  }
}
