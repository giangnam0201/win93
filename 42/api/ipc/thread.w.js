import { uid } from "../uid.js"
import { repaintThrottle } from "../../lib/timing/repaintThrottle.js"
import { isPlainObject } from "../../lib/type/any/isPlainObject.js"
import { getAllMethodNames } from "../../lib/type/object/getAllMethods.js"
import { serializeError } from "./serialize.js"

const modules = new Map()
const classes = new Map()

let timerId

class Transfer {
  constructor(result, transfer) {
    this.result = result
    this.transfer = transfer
  }
}

Transfer.void = Symbol.for("Transfer.void")

globalThis.Transfer = Transfer

self.onmessage = async ({ data }) => {
  if (!data.id) throw new Error("Missing worker id")

  if (data.call || data.method) {
    const { id, callId, call, method, args } = data
    try {
      const res = method
        ? await classes.get(data.classId)[method](...args)
        : await modules.get(id)[call](...args)

      // if (method) console.log(`- ${data.className}.${method} :`, res)

      if (res instanceof Transfer) {
        self.postMessage({ callId, res: res.result }, res.transfer)
      } else if (
        res instanceof ReadableStream ||
        res instanceof WritableStream ||
        res instanceof TransformStream
      ) {
        self.postMessage({ callId, res }, [res])
      } else if (
        typeof res === "object" &&
        !isPlainObject(res) &&
        !Array.isArray(res)
      ) {
        const classId = uid()
        classes.set(classId, res)
        self.postMessage({
          callId,
          classId,
          className: res.constructor.name,
          methods: getAllMethodNames(res),
        })
      } else if (res !== Transfer.void) {
        self.postMessage({ callId, res })
      }
    } catch (error) {
      self.postMessage({ callId, error: serializeError(error) })
    }
  }

  if (data.import) {
    clearTimeout(timerId)
    const { id } = data
    import(data.import)
      .then((m) => {
        const module = { ...m }

        if (data.throttleExports) {
          for (const key of data.throttleExports) {
            if (key in module) module[key] = repaintThrottle(module[key])
          }
        }

        modules.set(id, module)
        self.postMessage({ id, exports: Object.keys(module) })
      })
      .catch((error) => {
        self.postMessage({ id, error: serializeError(error) })
      })
  }

  if (data.destroy) {
    const { id } = data
    modules.delete(id)

    // Allow time to use the worker again before destroying
    timerId = setTimeout(() => {
      if (modules.size === 0) self.postMessage({ destroyWorker: true })
    }, 3000)
  }
}

self.postMessage({ loaded: true })
