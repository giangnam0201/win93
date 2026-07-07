export class Driver {
  /** @type {number} */ mask
  /** @type {any} */ store

  constructor(config) {
    this.config = config
  }

  async init() {
    return this
  }

  async getURL() {
    throw new Error(`${this.constructor.name}.getURL() is not implemented`)
  }

  /* check
  ======== */

  async access() {
    throw new Error(`${this.constructor.name}.access() is not implemented`)
  }

  async isFile() {
    throw new Error(`${this.constructor.name}.isFile() is not implemented`)
  }

  async isDir() {
    throw new Error(`${this.constructor.name}.isDir() is not implemented`)
  }

  async isLink() {
    throw new Error(`${this.constructor.name}.isLink() is not implemented`)
  }

  /* file
  ======= */

  async link() {
    throw new Error(`${this.constructor.name}.link() is not implemented`)
  }

  async open() {
    throw new Error(`${this.constructor.name}.open() is not implemented`)
  }

  async read(_filename, _options) {
    throw new Error(`${this.constructor.name}.read() is not implemented`)
  }

  async write(_filename, _data, _options) {
    throw new Error(`${this.constructor.name}.write() is not implemented`)
  }

  async delete() {
    throw new Error(`${this.constructor.name}.delete() is not implemented`)
  }

  async append() {
    throw new Error(`${this.constructor.name}.append() is not implemented`)
  }

  /* dir
  ====== */

  async writeDir() {
    throw new Error(`${this.constructor.name}.writeDir() is not implemented`)
  }

  async readDir() {
    throw new Error(`${this.constructor.name}.readDir() is not implemented`)
  }

  async deleteDir() {
    throw new Error(`${this.constructor.name}.deleteDir() is not implemented`)
  }

  /* stream
  ========= */

  /** @returns {Promise<WritableStream>} */
  async sink(_filename, _options) {
    throw new Error(`${this.constructor.name}.sink() is not implemented`)
  }

  /** @returns {Promise<ReadableStream>} */
  async source(_filename, _options) {
    throw new Error(`${this.constructor.name}.source() is not implemented`)
  }
}
