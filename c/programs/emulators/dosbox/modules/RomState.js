import { fs } from "../../../../../42/api/fs.js"
import { normalizeFilename } from "../../../../../42/api/fs/normalizeFilename.js"
import { extract } from "../../../../../42/formats/compression/zip.js"
import { getStemname } from "../../../../../42/lib/syntax/path/getStemname.js"
// import { sdbm } from "../../../../../42/lib/algo/sdbm.js"

export class RomState {
  ci

  constructor(path, app) {
    this.romPath = path
    // this.name = `${getStemname(path)}_${sdbm(this.path)}.zip`
    this.stateName = `${getStemname(path)}.state.zip`
    this.statePath = normalizeFilename(
      `~/config/${app.command}/${this.stateName}`,
    )
  }

  async getChanges() {
    try {
      if (await fs.access(this.statePath)) {
        return new Uint8Array(await fs.read(this.statePath))
      }
    } catch {}
  }

  async load() {
    if (await fs.access(this.statePath)) {
      const undones = []

      try {
        for (const { name, file } of await extract(this.statePath)) {
          console.log(name)
          undones.push(
            file
              .arrayBuffer()
              .then((arr) => this.ci.fsWriteFile(name, new Uint8Array(arr))),
          )
        }
      } catch (err) {
        console.log(err)
      }

      await Promise.all(undones)
    }
  }

  async save() {
    const changes = await this.ci.persist()
    if (!changes) return
    await fs.write(this.statePath, changes)
  }
}
