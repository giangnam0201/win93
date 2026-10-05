export class LoadError extends Error {
  constructor(message, details) {
    super(message, { cause: details?.cause })
    Object.defineProperty(this, "name", { value: "LoadError" })
    if (details) Object.assign(this, details)
  }
}
