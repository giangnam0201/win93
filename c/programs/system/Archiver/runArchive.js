let JS7z

const runtimeURL = new URL("../../../libs/js7z/2.5/js7z.js", import.meta.url)

/**
 * Run a command in a fresh filesystem, copying results before runtime exit.
 * @template T
 * @param {string[]} args
 * @param {(FS: any) => void} prepare
 * @param {(FS: any) => T} collect
 * @returns {Promise<T>}
 */
export async function runArchive(args, prepare, collect) {
  JS7z ??= await import("../../../libs/js7z/2.5/js7z.js").then((m) => m.default)

  return new Promise((resolve, reject) => {
    const errors = []
    let runtime
    JS7z({
      mainScriptUrlOrBlob:
        runtimeURL.protocol === "file:" ? runtimeURL.pathname : runtimeURL.href,
      print() {},
      printErr(line) {
        errors.push(line)
        if (errors.length > 20) errors.shift()
      },
      onAbort(reason) {
        reject(new Error(`Archive operation aborted: ${reason}`))
      },
      onExit(code) {
        if (code !== 0) {
          reject(
            new Error(errors.join("\n") || `JS7z exited with code ${code}`),
          )
          return
        }
        try {
          resolve(collect(runtime.FS))
        } catch (err) {
          reject(err)
        }
      },
    })
      .then((instance) => {
        runtime = instance
        prepare(runtime.FS)
        runtime.callMain(args)
      })
      .catch(reject)
  })
}
