import { capitalize } from "../../lib/type/string/capitalize.js"
import { toCapitalCase } from "../../lib/type/string/transform.js"

function getCauseMessage(cause) {
  return `Database error (${
    cause.message || capitalize(toCapitalCase(cause.name).toLowerCase())
  })`
}

export class DatabaseError extends Error {
  constructor(cause, details) {
    if (typeof cause === "string") {
      super(cause)
      Object.defineProperty(this, "name", {
        configurable: true,
        value: "DatabaseError",
      })
    } else {
      super(getCauseMessage(cause))
      Object.defineProperty(this, "name", {
        configurable: true,
        value: cause.name === "Error" ? "DatabaseError" : cause.name,
      })
      this.cause = cause
    }

    if (details) this.details = details
  }

  causedBy(cause, details) {
    if (!cause) return this

    this.cause = cause

    const oldStackTitle = `${this.name}: ${this.message}`

    Object.defineProperty(this, "name", {
      configurable: true,
      value: cause.name === "Error" ? "DatabaseError" : cause.name,
    })

    this.message = getCauseMessage(cause)

    const newStackTitle = `${this.name}: ${this.message}`

    if (!this.stack.startsWith(newStackTitle)) {
      Object.defineProperty(this, "stack", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: this.stack.replace(oldStackTitle, newStackTitle),
      })
    }

    if (details) this.details = details

    return this
  }
}
