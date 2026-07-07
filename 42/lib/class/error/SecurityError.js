export class SecurityError extends Error {
  constructor(message) {
    super(message)
    Object.defineProperties(this, {
      name: { value: "SecurityError" },
      code: { value: DOMException.SECURITY_ERR },
    })
  }
}
