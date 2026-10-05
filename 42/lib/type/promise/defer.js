import { TimeoutError } from "../../class/error/TimeoutError.js"

export class Deferred extends Promise {
  static get [Symbol.species]() {
    return Promise
  }

  get [Symbol.toStringTag]() {
    return "Deferred"
  }

  constructor(options) {
    let resolve
    let reject
    super((superResolve, superReject) => {
      resolve = (arg) => {
        this.isPending = false
        this.isResolved = true
        superResolve(arg)
      }

      reject = (err) => {
        this.isPending = false
        this.isRejected = true
        superReject(err)
      }

      const timeout = options?.timeout
      if (timeout) {
        let err =
          typeof options?.timeoutError === "string"
            ? new TimeoutError(options?.timeoutError)
            : options?.timeoutError ?? new TimeoutError(timeout)

        setTimeout(() => {
          if (this.isPending) superReject(err)
          err = undefined
        }, timeout)
      }
    })

    this.resolve = resolve
    this.reject = reject

    this.isPending = true
    this.isRejected = false
    this.isResolved = false
  }
}

export function defer(options) {
  return new Deferred(options)
}
